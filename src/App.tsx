/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  BookOpen, 
  PenTool, 
  HelpCircle, 
  FileText, 
  LogOut, 
  Plus, 
  ChevronRight, 
  Trash2, 
  Save, 
  Eye, 
  Edit3, 
  Languages, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  LayoutGrid,
  Bookmark,
  ChevronLeft,
  ChevronUp,
  Check,
  X,
  Clock,
  MessageCircle,
  Send,
  Globe,
  Copy,
  ChevronDown,
  Camera,
  ImagePlus,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { diff_match_patch } from 'diff-match-patch';
import { cn } from './lib/utils';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface Writing {
  id: string;
  title: string;
  content: string;
  originalContent?: string;
  correctedContent?: string;
  furiganaContent?: string;
  images?: string[];
  vocabularyList?: { word: string; reading: string; meaning: string; example?: string }[];
  qaList?: { q: string; a: string; text: string }[];
  authorId: string;
  createdAt: any;
}

interface Quiz {
  id: string;
  topic: string;
  level: string;
  questions: {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }[];
  authorId: string;
  createdAt: any;
}

interface Article {
  id: string;
  originalUrl?: string;
  originalText?: string;
  rewrittenText: string;
  level: string;
  topic?: string;
  vocabularyList?: { word: string; reading: string; meaning: string }[];
  authorId: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student';
}

interface Student {
  email: string;
  name: string;
  role: 'student';
}

type View = 'dashboard' | 'writing-workspace' | 'quiz-gen' | 'article-rewrite' | 'role-selection';
type Language = 'ja' | 'en';

const TRANSLATIONS = {
  ja: {
    common: {
      logout: "ログアウト",
      back: "戻る",
      cancel: "キャンセル",
      save: "保存",
      delete: "削除",
      new: "新規",
      untitled: "無題",
      loading: "読み込み中...",
      hide: "隠す",
      fold: "折りたたむ",
    },
    dashboard: {
      greeting: (name: string) => `こんにちは、${name}さん`,
      subGreeting: (role: string) => role === 'teacher' ? "今日は何を教えますか？" : "今日は何を学びますか？",
      workspaceTitle: "作文ワークスペース",
      workspaceDesc: "生徒の作文を管理・添削し、ふりがなを振ったり単語を抽出したりします。",
      quizTitle: "クイズ生成 / 単語テスト",
      quizDesc: "自動的なクイズ作成や、保存した単語のテストができます。",
      articleTitle: "AI記事ジェネレーター",
      articleDesc: "トピックからJLPTレベル別の読解教材を自動生成し、語彙を記録します。",
      recentWritings: "最近の作文",
      noWritings: "まだ作文がありません。",
    },
    workspace: {
      savedWritings: "保存した作文",
      myWritings: "自分の作文",
      composer: "作文",
      composerDesc: "英語でも日本語でも入力できます。読むモードでふりがな表示。",
      newBtn: "新しい作文",
      saveBtn: "保存",
      title: "タイトル",
      view: "閲覧",
      edit: "編集",
      furigana: "ふりがな",
      on: "あり",
      off: "なし",
      memoryBank: "語彙リスト",
      questions: "質問",
      questionsDesc: "選択テキストに関するQ&A。",
      images: "参考画像",
      imagesDesc: "この作文に画像を追加して、必要なときに拡大表示できます。",
      browseBtn: "参照",
      dropImage: "ここに画像をドロップ、またはクリックして追加します。",
      historyTitle: "添削履歴 (変更箇所)",
      titlePlaceholder: "例: 私の週末",
      contentPlaceholder: "入力するとここに表示されます。",
      menuTranslate: "翻訳",
      menuAddVocab: "語彙に追加",
      menuCopy: "コピー",
      menuAsk: "質問",
      translating: "翻訳中...",
      askPlaceholder: "質問を入力...",
      sendBtn: "送信",
      vocabTitle: "語彙リスト",
      vocabWordPlaceholder: "単語",
      vocabReadingPlaceholder: "よみがな",
      vocabMeaningPlaceholder: "英語の意味",
      newVocabPlaceholder: "新しい単語",
      noVocab: "まだ語彙がありません。本文のテキストを選択して追加しましょう。",
      qnaPlaceholder: "テキストを選択して「質問」ボタンから質問できます。",
      hideBtn: "隠す",
      targetLabel: "対象テキスト",
      teacherPlaceholder: "先生からの回答を入力...",
      deleteConfirmTitle: "本当に削除しますか？",
      deleteConfirmBody: (title: string) => `「${title}」を削除します。この操作は取り消せません。`,
    },
    quiz: {
      title: "クイズ＆テスト生成",
      aiTab: "AI文法クイズ",
      memoryTab: "Memory Bank テスト",
      topicLabel: "トピック（文法・語彙）",
      topicPlaceholder: "例：尊敬語、助詞「は」と「が」の使い分けなど",
      levelLabel: "JLPTレベル",
      genBtn: "クイズを作成する",
      testSelectTitle: "テスト対象を選んでください",
      testSelectDesc: "リストから複数の作文にチェックをいれて開始できます。",
      testStartBtn: "チェックを入れたもののテストを開始",
      emptyVocab: "まだ単語が保存されている作文がありません。作文ワークスペースで単語を保存してください。",
      tableDate: "作成日",
      tableTitle: "作文タイトル",
      tableCount: "単語数",
      tableDetails: "詳細",
      expandWordReading: "単語 / よみ",
      expandMeaning: "意味",
      expandExample: "一文作成 (テスト時に入力)",
      noExample: "（未実施・空欄）",
      questionNum: (current: number, total: number) => `問題 ${current} / ${total}`,
      targetWriting: (title: string) => `対象: ${title}`,
      meaningLabel: "英語の意味は？",
      meaningPlaceholder: "例: to eat, apple...",
      checkBtn: "判定する",
      correct: "正解！",
      incorrect: "不正解...",
      partial: "おしい！",
      modelAnswer: (answer: string) => `✅ モデルの回答: ${answer}`,
      sentenceTitle: "✏️ 一文を作ってみよう",
      sentenceDesc: (word: string) => `この単語「${word}」を使って、簡単な文を書いてください。`,
      sentencePlaceholder: (word: string) => `例：私は毎日${word}を...`,
      nextBtn: "保存して次へ",
      finishBtn: "結果を見る",
      completedTitle: "テスト完了！",
      completedDesc: (total: number) => `合計${total}個の単語テストと例文作成が完了しました。`,
      resultWord: "単語",
      resultMeaning: "意味",
      resultSentence: "作成した一文",
      notEntered: "（未入力）",
      backToSelection: "単語テスト選択に戻る",
    },
    rewrite: {
      title: "AI記事ジェネレーター",
      genTopicLabel: "どんな記事を作りたいですか？",
      genTopicPlaceholder: "キーワードを入力（例：日本の桜、最新のAI）",
      genBtn: "記事を生成する",
      saveBtn: "記事を保存",
      resultTitle: "生成された記事",
      emptyResult: "生成された記事がここに表示されます。",
      copyBtn: "本文をコピー",
      historyTitle: "保存された記事の履歴",
      noHistory: "まだ保存された記事がありません。",
      memoryBank: "Memory Bank (語彙・文法記録)",
      memoryBankDesc: "記事から学習したい語彙や文法を手動で記録しましょう。",
      vocabWord: "単語/文法",
      vocabReading: "読み",
      vocabMeaning: "意味",
      addBtn: "追加",
      furiganaBtn: "ふりがな",
      genPrompt: (topic: string, level: string) => `トピック「${topic}」について、JLPT ${level}レベルの語彙と文法で、約400～500文字の興味深い日本語の記事を作成してください。
記事のタイトルを簡潔に（20文字以内）必ず最初の行に含めてください。
Markdown記号（#や**など）は一切使用しないでください。改行を使って読みやすく構成してください。
出力は記事のタイトルと本文のみとし、それ以外の説明（「はい、作成しました」など）は一切含めないでください。`,
    },
    login: {
      title: "NIHONGO AI",
      desc: "日本語学習アシスタント",
      btn: "Googleでログイン",
      tos: "ログインすることで利用規約に同意したことになります。",
      roleTitle: "あなたのロールを選んでください",
      roleTeacher: "先生 / 教師 (Teacher)",
      roleTeacherDesc: "教材作成、作文の添削、クイズ管理ができます。",
      roleStudent: "生徒 / 学習者 (Student)",
      roleStudentDesc: "作文の練習、ふりがな付き読解、クイズ挑戦ができます。",
      roleConfirm: "確定する",
    }
  },
  en: {
    common: {
      logout: "Logout",
      back: "Back",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      new: "New",
      untitled: "Untitled",
      loading: "Loading...",
      hide: "Hide",
      fold: "Collapse",
    },
    dashboard: {
      greeting: (name: string) => `Hello, ${name}`,
      subGreeting: (role: string) => role === 'teacher' ? "What's on the lesson plan today?" : "Ready for some Japanese practice?",
      workspaceTitle: "Writing Workspace",
      workspaceDesc: "Manage and correct student writings, add furigana, and more.",
      quizTitle: "Quiz & Vocab Test",
      quizDesc: "Generate quizzes or test vocabulary from your writings.",
      articleTitle: "AI Article Generator",
      articleDesc: "Automatically generate JLPT-leveled reading materials and record vocabulary.",
      recentWritings: "Recent Writings",
      noWritings: "No writings yet.",
    },
    workspace: {
      savedWritings: "Saved Writings",
      myWritings: "My Writings",
      composer: "Composer",
      composerDesc: "Input in English or Japanese. View mode shows furigana.",
      newBtn: "New Writing",
      saveBtn: "Save",
      title: "Title",
      view: "View",
      edit: "Edit",
      furigana: "Furigana",
      on: "On",
      off: "Off",
      memoryBank: "Memory Bank",
      questions: "Q&A",
      questionsDesc: "Q&A regarding selected text.",
      images: "Images",
      imagesDesc: "Add images to this writing and expand them when needed.",
      browseBtn: "Browse",
      dropImage: "Drop images here or click to add.",
      historyTitle: "Correction History (Changes)",
      titlePlaceholder: "e.g., My Weekend",
      contentPlaceholder: "Your content will appear here.",
      menuTranslate: "Translate",
      menuAddVocab: "Add to Vocab",
      menuCopy: "Copy",
      menuAsk: "Ask",
      translating: "Translating...",
      askPlaceholder: "Type your question...",
      sendBtn: "Send",
      vocabTitle: "Vocabulary List",
      vocabWordPlaceholder: "Word",
      vocabReadingPlaceholder: "Reading",
      vocabMeaningPlaceholder: "Meaning",
      newVocabPlaceholder: "New Word",
      noVocab: "No words added yet. Select text to add to vocabulary.",
      qnaPlaceholder: "Select text and click \"Ask\" to ask questions.",
      hideBtn: "Hide",
      targetLabel: "Target Text",
      teacherPlaceholder: "Enter answer from teacher...",
      deleteConfirmTitle: "Are you sure?",
      deleteConfirmBody: (title: string) => `Deleting "${title}". This cannot be undone.`,
    },
    quiz: {
      title: "Quiz & Test Generator",
      aiTab: "AI Grammar Quiz",
      memoryTab: "Memory Bank Test",
      topicLabel: "Topic (Grammar/Vocab)",
      topicPlaceholder: "e.g., Keigo, Particles ha/ga difference",
      levelLabel: "JLPT Level",
      genBtn: "Generate Quiz",
      testSelectTitle: "Select for Testing",
      testSelectDesc: "Select multiple writings to create a combined test.",
      testStartBtn: "Start Test for Selected",
      emptyVocab: "No writings with saved vocabulary yet. Save words in the workspace first.",
      tableDate: "Date",
      tableTitle: "Writing Title",
      tableCount: "Words",
      tableDetails: "Details",
      expandWordReading: "Word / Reading",
      expandMeaning: "Meaning",
      expandExample: "Sentence (Input during test)",
      noExample: "(Not completed)",
      questionNum: (current: number, total: number) => `Question ${current} / ${total}`,
      targetWriting: (title: string) => `Target: ${title}`,
      meaningLabel: "What is the English meaning?",
      meaningPlaceholder: "e.g., to eat, apple...",
      checkBtn: "Check Answer",
      correct: "Correct!",
      incorrect: "Incorrect...",
      partial: "Almost!",
      modelAnswer: (answer: string) => `✅ Model answer: ${answer}`,
      sentenceTitle: "✏️ Let's make a sentence",
      sentenceDesc: (word: string) => `Write a simple sentence using the word "${word}".`,
      sentencePlaceholder: (word: string) => `e.g., I eat ${word} every day...`,
      nextBtn: "Save & Next",
      finishBtn: "View Results",
      completedTitle: "Test Completed!",
      completedDesc: (total: number) => `Finished testing ${total} words and sentence building.`,
      resultWord: "Word",
      resultMeaning: "Meaning",
      resultSentence: "Your Sentence",
      notEntered: "(Not entered)",
      backToSelection: "Back to Selection",
    },
    rewrite: {
      title: "AI Article Generator",
      genTopicLabel: "What kind of article do you want to create?",
      genTopicPlaceholder: "Enter keywords (e.g., Cherry blossoms, AI news)",
      genBtn: "Generate Article",
      saveBtn: "Save Article",
      resultTitle: "Generated Article",
      emptyResult: "The generated article will appear here.",
      copyBtn: "Copy Text",
      historyTitle: "Saved Articles History",
      noHistory: "No saved articles yet.",
      memoryBank: "Memory Bank",
      memoryBankDesc: "Manually record vocabulary and grammar you want to learn from the article.",
      vocabWord: "Word/Grammar",
      vocabReading: "Reading",
      vocabMeaning: "Meaning",
      addBtn: "Add",
      furiganaBtn: "Furigana",
      genPrompt: (topic: string, level: string) => `Write an interesting Japanese article about "${topic}" for JLPT ${level} learners (approx. 400-500 characters). 
Include a concise title (max 20 chars) on the very first line.
Do NOT use Markdown symbols like #, **, or *. Use only plain text and line breaks for readability. 
Output ONLY the article title and content. Do not include any introductory remarks like "Here is the article".`,
    },
    login: {
      title: "NIHONGO AI",
      desc: "Japanese Learning Assistant",
      btn: "Sign in with Google",
      tos: "By signing in, you agree to our Terms of Service.",
      roleTitle: "Choose Your Role",
      roleTeacher: "Teacher",
      roleTeacherDesc: "Create materials, correct writings, and manage quizzes.",
      roleStudent: "Student",
      roleStudentDesc: "Practice writing, read articles with furigana, and take quizzes.",
      roleConfirm: "Confirm Role",
    }
  }
};

// --- Gemini Service ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const geminiModel = "gemini-3-flash-preview";

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className, 
  disabled, 
  isLoading 
}: { 
  children: React.ReactNode; 
  onClick?: (e?: any) => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'soft'; 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}) => {
  const variants = {
    primary: 'bg-[#D97736] text-white hover:bg-[#C2662B]',
    secondary: 'bg-[#F3E8E0] text-[#5C4D43] hover:bg-[#E8D5C8]',
    outline: 'border border-[#E8D5C8] text-[#5C4D43] hover:bg-[#FDFBF7]',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    ghost: 'text-[#5C4D43] hover:bg-[#F3E8E0]',
    soft: 'bg-[#FFF8F3] text-[#D97736] hover:bg-[#FFEFE3]'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'rounded-full font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white rounded-[2rem] shadow-sm overflow-hidden', className)}
  >
    {children}
  </div>
);

const Badge = ({ children, color = 'orange', className }: { children: React.ReactNode; color?: string; className?: string }) => {
  const colors: Record<string, string> = {
    orange: 'bg-[#FFF8F3] text-[#D97736] border-[#FFEFE3]',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center', colors[color] || colors.orange, className)}>
      {children}
    </span>
  );
};

// --- Main App ---

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

  const Dashboard = ({ user, userProfile, handleLogout, setCurrentView, writings, setSelectedWriting, lang, students, selectedStudentEmail, setSelectedStudentEmail }: any) => {
    const t = TRANSLATIONS[lang as Language];
    const isTeacher = userProfile?.role === 'teacher';

    return (
      <div className="space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#4A3F35]">{t.dashboard.greeting(user?.displayName)}</h1>
            <p className="text-[#8C7A6B]">{t.dashboard.subGreeting(userProfile?.role)}</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isTeacher && (
              <div className="flex items-center gap-2 bg-[#FFF8F3] border border-[#F3E8E0] px-3 py-1.5 rounded-full">
                <span className="text-xs font-bold text-[#8C7A6B]">担当生徒:</span>
                <select 
                  className="text-sm font-medium bg-transparent border-none outline-none focus:ring-0 text-[#4A3F35]"
                  value={selectedStudentEmail || ""}
                  onChange={(e) => setSelectedStudentEmail(e.target.value)}
                >
                  <option value="">生徒を選択してください</option>
                  {students.map((s: any) => (
                    <option key={s.email} value={s.email}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4" /> {t.common.logout}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 hover:border-[#D97736] border border-[#F3E8E0] transition-colors cursor-pointer group" onClick={() => setCurrentView('writing-workspace')}>
            <div className="w-12 h-12 bg-[#FFF8F3] text-[#D97736] rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#D97736] group-hover:text-white transition-colors">
              <PenTool className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[#4A3F35]">{t.dashboard.workspaceTitle}</h3>
            <p className="text-[#8C7A6B] text-sm">{t.dashboard.workspaceDesc}</p>
          </Card>

          <Card className="p-6 hover:border-[#D97736] border border-[#F3E8E0] transition-colors cursor-pointer group" onClick={() => setCurrentView('quiz-gen')}>
            <div className="w-12 h-12 bg-[#FFF8F3] text-[#D97736] rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#D97736] group-hover:text-white transition-colors">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[#4A3F35]">{t.dashboard.quizTitle}</h3>
            <p className="text-[#8C7A6B] text-sm">{t.dashboard.quizDesc}</p>
          </Card>

          <Card className="p-6 hover:border-[#D97736] border border-[#F3E8E0] transition-colors cursor-pointer group" onClick={() => setCurrentView('article-rewrite')}>
            <div className="w-12 h-12 bg-[#FFF8F3] text-[#D97736] rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#D97736] group-hover:text-white transition-colors">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[#4A3F35]">{t.dashboard.articleTitle}</h3>
            <p className="text-[#8C7A6B] text-sm">{t.dashboard.articleDesc}</p>
          </Card>
        </div>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-[#4A3F35]">{isTeacher ? "生徒の最新の投稿" : t.dashboard.recentWritings}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {writings.slice(0, 4).map(w => (
              <Card key={w.id} className="p-4 flex justify-between items-center hover:bg-[#FFF8F3] border border-[#F3E8E0] cursor-pointer transition-colors" onClick={() => { setSelectedWriting(w); setCurrentView('writing-workspace'); }}>
                <div>
                  <h4 className="font-bold text-[#4A3F35]">{w.title || t.common.untitled}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {isTeacher && <Badge color="indigo" className="text-[10px] py-0 px-2">Student</Badge>}
                    <p className="text-xs text-[#8C7A6B]">{new Date(w.createdAt?.toDate()).toLocaleDateString()}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#8C7A6B]" />
              </Card>
            ))}
            {writings.length === 0 && <p className="text-[#8C7A6B] italic">{t.dashboard.noWritings}</p>}
          </div>
        </section>
      </div>
    );
  };

  const WritingWorkspace = ({ user, userProfile, writings, setWritings, selectedWriting, setSelectedWriting, isProcessing, setIsProcessing, lang }: any) => {
    const t = TRANSLATIONS[lang as Language];
    const isTeacher = userProfile?.role === 'teacher';
  const generateFurigana = async (text: string, onChunk: (chunk: string) => void) => {
    if (!text) return "";
    setIsProcessing(true);
    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.1-flash-lite-preview",
        contents: `以下の日本語の文章の「漢字」にのみ、HTMLの<ruby>タグ形式でふりがなを振ってください。例：<ruby>漢字<rt>かんじ</rt></ruby>。
重要：
1. 元の文章にある文字（ひらがな、カタカナ、記号、英数字など）は一切変更しないでください。ひらがなを漢字に変換することは絶対に禁止です。
2. 漢字以外の文字はそのままで、既存の漢字のみをrubyタグで囲んでください。
3. 改行、段落構成、空白などは、一切変更せずそのまま保持してください。
4. 出力はHTML（rubyタグ付きテキスト）のみとし、説明文やマークダウンなどは含めないでください。\n\n${text}`,
      });
      let fullText = "";
      for await (const chunk of responseStream) {
        const chunkText = (chunk as any).text || "";
        fullText += chunkText;
        let cleanText = fullText.replace(/^```html\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '');
        onChunk(cleanText);
      }
      return fullText.replace(/^```html\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();
    } catch (err) {
      console.error(err);
      return "";
    } finally {
      setIsProcessing(false);
    }
  };

    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [editedTitle, setEditedTitle] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [selection, setSelection] = useState('');
    const [question, setQuestion] = useState('');
    const [isAsking, setIsAsking] = useState(false);
    const [showFurigana, setShowFurigana] = useState(false);
    const [streamingFurigana, setStreamingFurigana] = useState<string | null>(null);
    
    // New UI states
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
    const [popupMode, setPopupMode] = useState<'menu' | 'question' | 'translation'>('menu');
    const [translationResult, setTranslationResult] = useState('');
    const [newVocabWord, setNewVocabWord] = useState('');
    const [newVocabReading, setNewVocabReading] = useState('');
    const [newVocabMeaning, setNewVocabMeaning] = useState('');
    const [writingToDelete, setWritingToDelete] = useState<Writing | null>(null);
    const [selectedImagePopup, setSelectedImagePopup] = useState<string | null>(null);

    const dmp = useMemo(() => new diff_match_patch(), []);
    const diffMarkup = useMemo(() => {
      if (!selectedWriting || !selectedWriting.originalContent || selectedWriting.originalContent === selectedWriting.content) return null;
      const d = dmp.diff_main(selectedWriting.originalContent, selectedWriting.content);
      dmp.diff_cleanupSemantic(d);
      
      return d.map((part, index) => {
        const type = part[0];
        const text = part[1];
        
        if (type === 1) { // INSERT
          return <span key={index} className="bg-[#e6ffe6] text-green-800 underline decoration-green-500">{text}</span>;
        } else if (type === -1) { // DELETE
          return <span key={index} className="bg-[#ffe6e6] text-red-800 line-through decoration-red-500">{text}</span>;
        } else { // EQUAL
          return <span key={index}>{text}</span>;
        }
      });
    }, [selectedWriting?.originalContent, selectedWriting?.content, dmp]);

    useEffect(() => {
      if (selectedWriting) {
        setEditedTitle(selectedWriting.title);
        setEditedContent(selectedWriting.content);
        setMode('view');
        setShowFurigana(!!selectedWriting.furiganaContent);
      }
    }, [selectedWriting?.id]);

    const handleAdd = async () => {
      if (!newTitle || !newContent || !user) return;
      setIsAdding(true);
      try {
        const res = await fetch('/api/essays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_email: user.email,
            title: newTitle,
            content: newContent
          })
        });
        if (res.ok) {
          const { id } = await res.json();
          setNewTitle('');
          setNewContent('');
          // Local update or wait for re-fetch
          const newWriting = { 
            id: id.toString(), 
            title: newTitle, 
            content: newContent, 
            authorId: user.email, 
            createdAt: { toDate: () => new Date() } 
          } as Writing;
          setSelectedWriting(newWriting);
          setWritings([newWriting, ...writings]);
        }
      } catch (err) {
        console.error("Save failed", err);
      } finally {
        setIsAdding(false);
      }
    };

    const handleSave = async () => {
      if (!selectedWriting) return;
      setIsSaving(true);
      try {
        const payload: any = {
          title: editedTitle,
        };
        
        if (isTeacher) {
          payload.correction = editedContent;
          payload.feedback = selectedWriting.feedback;
        } else {
          payload.content = editedContent;
        }

        const res = await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          let updatedWriting;
          if (isTeacher) {
            updatedWriting = { ...selectedWriting, title: editedTitle, correctedContent: editedContent };
          } else {
            updatedWriting = { ...selectedWriting, title: editedTitle, content: editedContent };
          }
          setSelectedWriting(updatedWriting);
          setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updatedWriting : w));
          setMode('view');
        }
      } catch (err) {
        console.error("Update failed", err);
      } finally {
        setIsSaving(false);
      }
    };

    const generateAndShowFurigana = async () => {
      if (!selectedWriting) return;
      if (selectedWriting.furiganaContent && selectedWriting.content === editedContent) {
        setShowFurigana(true);
        return;
      }
      
      setShowFurigana(true);
      setStreamingFurigana("");
      
      const furigana = await generateFurigana(editedContent, (chunk) => {
        setStreamingFurigana(chunk);
      });
      
      try {
        const res = await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editedTitle,
            content: editedContent,
            furigana_content: furigana
          })
        });
        if (res.ok) {
          const updated = { ...selectedWriting, content: editedContent, title: editedTitle, furiganaContent: furigana };
          setSelectedWriting(updated);
          setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
        }
      } catch (err) {
        console.error("Furigana update failed", err);
      } finally {
        setStreamingFurigana(null);
      }
    };

    const handleDelete = async (w: Writing) => {
      setWritingToDelete(w);
    };

    const handleDeleteConfirm = async (w: Writing) => {
      try {
        await fetch(`/api/essays/${w.id}`, { method: 'DELETE' });
        setWritings(writings.filter(item => item.id !== w.id));
        if (selectedWriting?.id === w.id) setSelectedWriting(null);
        setWritingToDelete(null);
      } catch (err) {
        console.error("Delete failed", err);
      }
    };

    const handleTextSelection = () => {
      const activeEl = document.activeElement;
      const isTextArea = activeEl && activeEl.tagName === 'TEXTAREA';

      // Use setTimeout to ensure selection is captured after mouseup event completes
      setTimeout(() => {
        if (isTextArea) {
          const textarea = activeEl as HTMLTextAreaElement;
          const text = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim();
          if (text) {
            setSelection(text);
            setPopupMode('menu');
            setTranslationResult('');
            setQuestion('');
          } else {
            setSelection('');
          }
          return;
        }

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.toString().trim() !== '') {
          const range = sel.getRangeAt(0);
          const frag = range.cloneContents();
          
          // Helper div to extract text content
          const div = document.createElement('div');
          div.appendChild(frag);
          
          // Remove all furigana (ruby text) elements so they don't get included in the selection string
          const rtElements = div.querySelectorAll('rt');
          rtElements.forEach(rt => rt.remove());
          
          const rpElements = div.querySelectorAll('rp');
          rpElements.forEach(rp => rp.remove());

          const text = div.textContent?.trim() || '';
          
          if (text) {
            setSelection(text);
            setPopupMode('menu');
            setTranslationResult('');
            setQuestion('');
          } else {
            setSelection('');
          }
        } else {
          setSelection('');
        }
      }, 10);
    };

    const handleCopy = () => {
      if (selection) {
        navigator.clipboard.writeText(selection);
        setSelection('');
      }
    };

    const handleTranslate = async () => {
      if (!selection) return;
      setPopupMode('translation');
      setIsProcessing(true);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `以下のテキストを翻訳してください。日本語の場合は英語に、英語の場合は日本語に翻訳してください。\n\nテキスト: "${selection}"`,
        });
        setTranslationResult(response.text || "翻訳できませんでした。");
      } catch (err) {
        console.error(err);
        setTranslationResult("エラーが発生しました。");
      } finally {
        setIsProcessing(false);
      }
    };

    const handleAskQuestion = async () => {
      if (!selectedWriting || !selection || !question) return;
      setIsAsking(true);
      try {
        const newQa = { q: question, a: '', text: selection };
        const currentList = selectedWriting.qaList || [];
        const updatedList = [...currentList, newQa];
        
        const res = await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qa_list: updatedList })
        });
        if (res.ok) {
          const updated = { ...selectedWriting, qaList: updatedList };
          setSelectedWriting(updated);
          setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
          setQuestion('');
          setPopupMode('menu');
          setSelection('');
        }
      } catch (err) {
        console.error("QA update failed", err);
      } finally {
        setIsAsking(false);
      }
    };

    const handleAddVocabulary = async () => {
      if (!selectedWriting || !selection) return;
      setIsProcessing(true);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `以下の選択されたテキストから、対象となる単語（ふりがなが含まれている場合はふりがなを除いた漢字のみ）、その「よみがな」、および「英語の意味」を抽出してJSON形式で出力してください。\n\n選択テキスト: ${selection}`,
          config: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING, description: "単語（ふりがななし）" },
                reading: { type: Type.STRING, description: "よみがな" },
                meaning: { type: Type.STRING, description: "英語の意味" }
              },
              required: ["word", "reading", "meaning"]
            }
          }
        });
        let text = response.text || `{"word": "${selection}", "reading": "", "meaning": ""}`;
        text = text.replace(/^```json\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();
        let newVocab = JSON.parse(text);
        if (Array.isArray(newVocab)) {
          newVocab = newVocab[0];
        }
        
        const currentList = selectedWriting.vocabularyList || [];
        const updatedList = [...currentList, newVocab];
        
        try {
          const res = await fetch(`/api/essays/${selectedWriting.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabulary_list: updatedList })
          });
          if (res.ok) {
            const updated = { ...selectedWriting, vocabularyList: updatedList };
            setSelectedWriting(updated);
            setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
            setSelection('');
          }
        } catch (err) {
          console.error("Vocab update failed", err);
        }
      } catch (err) {
        console.error(err);
        const currentList = selectedWriting.vocabularyList || [];
        const updatedList = [...currentList, { word: selection, reading: '', meaning: '' }];
        try {
          const res = await fetch(`/api/essays/${selectedWriting.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabulary_list: updatedList })
          });
          if (res.ok) {
            const updated = { ...selectedWriting, vocabularyList: updatedList };
            setSelectedWriting(updated);
            setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
            setSelection('');
          }
        } catch (firestoreErr) {
          console.error("Vocab update failed", firestoreErr);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    const handleRemoveVocabulary = async (index: number) => {
      if (!selectedWriting || !selectedWriting.vocabularyList) return;
      const newList = selectedWriting.vocabularyList.filter((_, idx) => idx !== index);
      try {
        const res = await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: newList })
        });
        if (res.ok) {
          const updated = { ...selectedWriting, vocabularyList: newList };
          setSelectedWriting(updated);
          setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
        }
      } catch (err) {
        console.error("Vocab update failed", err);
      }
    };

    const handleUpdateVocabulary = (index: number, field: 'word' | 'reading' | 'meaning' | 'example', value: string) => {
      if (!selectedWriting || !selectedWriting.vocabularyList) return;
      const newList = [...selectedWriting.vocabularyList];
      newList[index] = { ...newList[index], [field]: value };
      setSelectedWriting({ ...selectedWriting, vocabularyList: newList });
    };

    const handleSaveVocabularyList = async () => {
      if (!selectedWriting || !selectedWriting.vocabularyList) return;
      try {
        await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: selectedWriting.vocabularyList })
        });
        setWritings(writings.map((w: any) => w.id === selectedWriting.id ? selectedWriting : w));
      } catch (err) {
        console.error("Vocab update failed", err);
      }
    };

    const handleUpdateQa = (index: number, field: 'q' | 'a', value: string) => {
      if (!selectedWriting || !selectedWriting.qaList) return;
      const newList = [...selectedWriting.qaList];
      newList[index] = { ...newList[index], [field]: value };
      setSelectedWriting({ ...selectedWriting, qaList: newList });
    };

    const handleSaveQaList = async () => {
      if (!selectedWriting || !selectedWriting.qaList) return;
      try {
        await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qa_list: selectedWriting.qaList })
        });
        setWritings(writings.map((w: any) => w.id === selectedWriting.id ? selectedWriting : w));
      } catch (err) {
        console.error("QA update failed", err);
      }
    };

    const handleRemoveQa = async (index: number) => {
      if (!selectedWriting || !selectedWriting.qaList) return;
      const newList = selectedWriting.qaList.filter((_, idx) => idx !== index);
      try {
        await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qa_list: newList })
        });
        const updated = { ...selectedWriting, qaList: newList };
        setSelectedWriting(updated);
        setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
      } catch (err) {
        console.error("QA removal failed", err);
      }
    };

    const handleManualAddVocabulary = async () => {
      if (!selectedWriting || !newVocabWord) return;
      const newVocab = { word: newVocabWord, reading: newVocabReading, meaning: newVocabMeaning };
      const currentList = selectedWriting.vocabularyList || [];
      const updatedList = [...currentList, newVocab];
      try {
        const res = await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: updatedList })
        });
        if (res.ok) {
          const updated = { ...selectedWriting, vocabularyList: updatedList };
          setSelectedWriting(updated);
          setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
          setNewVocabWord('');
          setNewVocabReading('');
          setNewVocabMeaning('');
        }
      } catch (err) {
        console.error("Vocab update failed", err);
      }
    };

    const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!selectedWriting) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          await processImageFile(file);
        }
      }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0] || !selectedWriting) return;
      await processImageFile(e.target.files[0]);
      e.target.value = ''; // Reset input
    };

    const processImageFile = async (file: File) => {
      if (!selectedWriting) return;
      setIsProcessing(true);
      try {
        const compressedBase64 = await compressImage(file);
        const currentImages = selectedWriting.images || [];
        const updatedImages = [...currentImages, compressedBase64];
        
        await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: updatedImages })
        });
        
        const updated = { ...selectedWriting, images: updatedImages };
        setSelectedWriting(updated);
        setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
      } catch (err) {
        console.error("Image upload failed", err);
      } finally {
        setIsProcessing(false);
      }
    };

    const handleRemoveImage = async (index: number) => {
      if (!selectedWriting || !selectedWriting.images) return;
      const updatedImages = selectedWriting.images.filter((_: any, i: number) => i !== index);
      try {
        await fetch(`/api/essays/${selectedWriting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: updatedImages })
        });
        const updated = { ...selectedWriting, images: updatedImages };
        setSelectedWriting(updated);
        setWritings(writings.map((w: any) => w.id === selectedWriting.id ? updated : w));
      } catch (err) {
        console.error("Image removal failed", err);
      }
    };

    return (
      <div className="flex flex-col md:flex-row gap-4 h-auto md:h-full">
        {selectedImagePopup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setSelectedImagePopup(null)}>
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors fade-in"
              onClick={() => setSelectedImagePopup(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={selectedImagePopup} 
              alt="Enlarged view" 
              className="max-w-3xl max-h-[80vh] w-full object-contain rounded-2xl shadow-2xl scale-in-center" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        )}
        {/* Left Column: Writings List */}
        <div className={cn("flex flex-col gap-3 transition-all duration-300 order-3 md:order-1", isLeftSidebarOpen ? "w-full md:w-[20%] md:min-w-[240px] h-[400px] md:h-full" : "w-full md:w-16 md:min-w-[64px] h-[60px] md:h-full")}>
          {writingToDelete && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="p-6 max-w-sm w-full mx-4">
                <h3 className="text-xl font-bold mb-4 text-[#4A3F35]">{t.workspace.deleteConfirmTitle}</h3>
                <p className="text-[#8C7A6B] mb-6">{t.workspace.deleteConfirmBody(writingToDelete.title || t.common.untitled)}</p>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setWritingToDelete(null)}>{t.common.cancel}</Button>
                  <Button variant="danger" onClick={() => {
                    handleDeleteConfirm(writingToDelete);
                    setWritingToDelete(null);
                  }}>{t.common.delete}</Button>
                </div>
              </Card>
            </div>
          )}
          <Card className="p-4 flex flex-col h-full border border-[#F3E8E0]">
            {isLeftSidebarOpen ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Badge color="orange" className="mb-1 text-[10px]"><LayoutGrid className="w-3 h-3 inline mr-1"/> Workspace</Badge>
                    <h2 className="text-sm font-bold text-[#4A3F35]">{t.workspace.savedWritings}</h2>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="px-2 py-1 text-xs" onClick={() => setIsLeftSidebarOpen(false)}><ChevronLeft className="w-3 h-3"/> {t.workspace.hideBtn}</Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-[#8C7A6B]">{t.workspace.myWritings}</h3>
                  <Button variant="outline" size="sm" onClick={() => setSelectedWriting(null)} className="px-2 py-1 bg-white text-xs">
                    <Plus className="w-3 h-3" /> {t.common.new}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {writings.map(w => (
                    <div 
                      key={w.id} 
                      className={cn(
                        "p-3 rounded-xl cursor-pointer transition-colors border flex justify-between items-center group", 
                        selectedWriting?.id === w.id ? "border-[#D97736] bg-[#FFF8F3]" : "border-[#F3E8E0] bg-[#FDFBF7] hover:bg-white"
                      )}
                      onClick={() => setSelectedWriting(w)}
                    >
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-[#4A3F35] truncate text-sm">{w.title || t.common.untitled}</h4>
                        <p className="text-[10px] text-[#8C7A6B] mt-0.5">{t.quiz.tableDate}: {w.createdAt ? new Date(w.createdAt.toDate()).toLocaleDateString() : ''}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setWritingToDelete(w); }}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center py-2">
                <Button variant="ghost" size="sm" onClick={() => setIsLeftSidebarOpen(true)} className="p-2">
                  <ChevronRight className="w-5 h-5 text-[#8C7A6B]" />
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Center Column: Composer */}
        <div className="flex-1 flex flex-col min-h-[500px] md:min-h-0 md:h-full min-w-0 order-1 md:order-2">
          <Card className="flex-1 flex flex-col overflow-hidden relative border border-[#F3E8E0] p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <Badge color="orange" className="mb-2"><FileText className="w-3 h-3 inline mr-1"/> Composer</Badge>
                <h2 className="text-base font-bold text-[#4A3F35]">{t.workspace.composer}</h2>
                <p className="text-[10px] text-[#8C7A6B] mt-1">{t.workspace.composerDesc}</p>
              </div>
              {selectedWriting && (
                <div className="flex flex-col gap-3 items-end">
                  <div className="flex bg-[#FFF8F3] p-1 rounded-xl border border-[#F3E8E0]">
                    <button 
                      className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2", mode === 'view' ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                      onClick={() => setMode('view')}
                    >
                      <Eye className="w-4 h-4" /> {t.workspace.view}
                    </button>
                    <button 
                      className={cn("px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2", mode === 'edit' ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                      onClick={() => setMode('edit')}
                    >
                      <Edit3 className="w-4 h-4" /> {t.workspace.edit}
                    </button>
                  </div>
                  
                  {mode === 'view' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#8C7A6B] flex items-center gap-1"><Languages className="w-4 h-4"/> {t.workspace.furigana}</span>
                      <div className="flex bg-[#FFF8F3] p-1 rounded-xl border border-[#F3E8E0]">
                        <button 
                          className={cn("px-4 py-1 rounded-lg text-sm font-bold transition-colors", showFurigana ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                          onClick={generateAndShowFurigana}
                          disabled={isProcessing}
                        >
                          {t.workspace.on}
                        </button>
                        <button 
                          className={cn("px-4 py-1 rounded-lg text-sm font-bold transition-colors", !showFurigana ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                          onClick={() => setShowFurigana(false)}
                          disabled={isProcessing}
                        >
                          {t.workspace.off}
                        </button>
                      </div>
                      {isProcessing && <Loader2 className="w-4 h-4 text-[#D97736] animate-spin" />}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedWriting ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-3">
                  <label className="block text-xs font-bold text-[#8C7A6B] mb-1">{t.workspace.title}</label>
                  {mode === 'edit' ? (
                    <input 
                      type="text" 
                      className="w-full p-3 text-base border border-[#F3E8E0] rounded-xl focus:ring-2 focus:ring-[#D97736] outline-none bg-[#FDFBF7]"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                    />
                  ) : (
                    <div className="w-full p-3 text-base border border-[#F3E8E0] rounded-xl bg-[#FDFBF7] text-[#4A3F35] flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#D97736]"/> {editedTitle}
                    </div>
                  )}
                </div>

                {mode === 'edit' && (
                  <div className="mb-4">
                    <Button onClick={handleSave} isLoading={isSaving} disabled={!editedTitle || !editedContent} size="sm"><Check className="w-4 h-4" /> {t.workspace.saveBtn}</Button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 pb-8">
                  <div className="relative rounded-2xl border border-[#F3E8E0] bg-[#FDFBF7] flex flex-col min-h-[500px] mb-6">
                    <div className="flex-1 shrink-0" onMouseUp={handleTextSelection}>
                      {mode === 'view' && (
                        <div className="p-6 whitespace-pre-wrap leading-[2.2] text-base text-[#4A3F35] h-full">
                          {showFurigana && (streamingFurigana !== null || selectedWriting.furiganaContent) ? (
                            <div className="furigana-content" dangerouslySetInnerHTML={{ __html: streamingFurigana !== null ? streamingFurigana : (selectedWriting.furiganaContent || '') }} />
                          ) : (
                            editedContent
                          )}
                        </div>
                      )}
                      {mode === 'edit' && (
                        <textarea 
                          className="w-full h-full min-h-[500px] p-6 bg-transparent outline-none text-base resize-none leading-[2.2] text-[#4A3F35]"
                          value={editedContent}
                          onMouseUp={handleTextSelection}
                          onChange={e => {
                            setEditedContent(e.target.value);
                            setShowFurigana(false);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Image Section */}
                  <div className="mb-6 border border-[#F3E8E0] bg-white p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge color="orange" className="mb-1 text-[10px] bg-[#FFF8F3] text-[#D97736] border-[#FFEFE3]">
                            <Camera className="w-3 h-3 inline mr-1" /> Reference images
                          </Badge>
                        </div>
                        <h3 className="font-bold text-[#4A3F35] text-lg">{t.workspace.images}</h3>
                        <p className="text-[#8C7A6B] text-[13px]">{t.workspace.imagesDesc}</p>
                      </div>
                      <div>
                        {/* Hidden file input */}
                        <input 
                          type="file" 
                          id="image-upload" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                        />
                        <label 
                          htmlFor="image-upload" 
                          className="cursor-pointer border border-[#E8D5C8] text-[#5C4D43] hover:bg-[#FDFBF7] px-4 py-2 rounded-full font-medium transition-all flex items-center justify-center gap-2 text-sm bg-white"
                        >
                          <Camera className="w-4 h-4" /> {t.workspace.browseBtn}
                        </label>
                      </div>
                    </div>

                    {selectedWriting.images && selectedWriting.images.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedWriting.images.map((imgUrl: string, idx: number) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-[#F3E8E0] cursor-pointer" onClick={() => setSelectedImagePopup(imgUrl)}>
                            <img src={imgUrl} alt={`Uploaded ${idx}`} className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                              className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleImageDrop}
                        className="bg-[#FFF8F3] border border-dashed border-[#E8D5C8] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[rgba(255,248,243,0.8)] transition-colors"
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        <ImagePlus className="w-8 h-8 text-[#5C4D43] mb-3 opacity-50" />
                        <p className="text-[#4A3F35] font-medium text-sm">{t.workspace.dropImage}</p>
                      </div>
                    )}
                  </div>

                  {diffMarkup && mode === 'view' && (
                    <div className="border border-[#F3E8E0] bg-white p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Edit3 className="w-5 h-5 text-[#D97736]" />
                        <h3 className="font-bold text-[#4A3F35]">{t.workspace.historyTitle}</h3>
                      </div>
                      <div className="whitespace-pre-wrap leading-[2.5] text-[#4A3F35] bg-[#FDFBF7] p-6 rounded-xl border border-[#F3E8E0]">
                        {diffMarkup}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // New Writing Form
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#8C7A6B] mb-2">{t.workspace.title}</label>
                  <input 
                    type="text" 
                    className="w-full p-4 text-lg border border-[#F3E8E0] rounded-2xl focus:ring-2 focus:ring-[#D97736] outline-none bg-[#FDFBF7]"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder={t.workspace.titlePlaceholder}
                  />
                </div>
                <div className="mb-4">
                  <Button onClick={handleAdd} isLoading={isAdding} disabled={!newTitle || !newContent} size="sm"><Check className="w-4 h-4" /> {t.workspace.saveBtn}</Button>
                </div>
                <div className="flex-1 overflow-y-auto relative rounded-2xl border border-[#F3E8E0] bg-[#FDFBF7]">
                  <textarea 
                    className="w-full h-full p-8 bg-transparent outline-none text-lg resize-none leading-[2.5] text-[#4A3F35]"
                    value={newContent}
                    onMouseUp={handleTextSelection}
                    onChange={e => setNewContent(e.target.value)}
                    placeholder={t.workspace.contentPlaceholder}
                  />
                </div>
              </div>
            )}
            
            {/* Floating Action for Vocabulary */}
            <AnimatePresence>
              {selection && selectedWriting && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-2xl p-4 flex flex-col gap-3 border border-[#F3E8E0] min-w-[320px] z-50"
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-[#4A3F35] px-1 truncate max-w-[250px]">選択: "{selection}"</span>
                    <button onClick={() => setSelection('')} className="text-[#8C7A6B] hover:text-[#4A3F35]"><X className="w-4 h-4"/></button>
                  </div>
                  
                  {popupMode === 'menu' && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleTranslate} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                        <Globe className="w-4 h-4 mr-1" /> {t.workspace.menuTranslate}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddVocabulary} isLoading={isProcessing} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                        <Plus className="w-4 h-4 mr-1" /> {t.workspace.menuAddVocab}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                        <Copy className="w-4 h-4 mr-1" /> {t.workspace.menuCopy}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPopupMode('question')} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                        <MessageCircle className="w-4 h-4 mr-1" /> {t.workspace.menuAsk}
                      </Button>
                    </div>
                  )}

                  {popupMode === 'translation' && (
                    <div className="bg-[#FDFBF7] p-3 rounded-xl border border-[#F3E8E0] text-sm text-[#4A3F35]">
                      {isProcessing ? <div className="flex items-center gap-2 text-[#8C7A6B]"><Loader2 className="w-4 h-4 animate-spin"/> {t.workspace.translating}</div> : translationResult}
                      {!isProcessing && (
                        <div className="mt-2 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setPopupMode('menu')} className="text-xs h-6 px-2">{t.common.back}</Button>
                        </div>
                      )}
                    </div>
                  )}

                  {popupMode === 'question' && (
                    <div className="flex flex-col gap-2">
                      <textarea 
                        className="w-full p-2 text-sm border border-[#F3E8E0] rounded-xl focus:ring-2 focus:ring-[#D97736] outline-none bg-[#FDFBF7] resize-none"
                        rows={2}
                        placeholder={t.workspace.askPlaceholder}
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                      />
                      <div className="flex justify-between items-center">
                        <Button variant="ghost" size="sm" onClick={() => setPopupMode('menu')} className="text-xs h-6 px-2 text-[#8C7A6B]">{t.common.back}</Button>
                        <Button size="sm" onClick={handleAskQuestion} isLoading={isAsking} disabled={!question} className="rounded-full h-7 px-3 text-xs">
                          <Send className="w-3 h-3 mr-1" /> {t.workspace.sendBtn}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>

        {/* Right Column: Memory Bank & Questions */}
        <div className={cn("flex flex-col gap-4 transition-all duration-300 order-2 md:order-3", isRightSidebarOpen ? "w-full md:w-[22%] md:min-w-[260px] h-[400px] md:h-full" : "w-full md:w-16 md:min-w-[64px] h-[60px] md:h-full")}>
          {isRightSidebarOpen ? (
            <>
              {/* Vocabulary List */}
              <Card className="flex-1 flex flex-col overflow-hidden border border-[#F3E8E0] p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Badge color="orange" className="mb-1 text-[10px]"><Bookmark className="w-3 h-3 inline mr-1"/> Memory bank</Badge>
                    <h3 className="text-sm font-bold text-[#4A3F35]">{t.workspace.vocabTitle}</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="px-2 py-1 text-xs" onClick={() => setIsRightSidebarOpen(false)}><ChevronRight className="w-3 h-3"/> {t.workspace.hideBtn}</Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <div className="space-y-2">
                    {selectedWriting?.vocabularyList?.map((v, i) => (
                      <div key={i} className="flex gap-1.5 items-start bg-[#FDFBF7] p-2 rounded-xl border border-[#F3E8E0] relative group">
                        <div className="flex-1 flex flex-col gap-0">
                          <div className="flex items-baseline gap-2">
                            <input 
                              type="text" 
                              value={v.word} 
                              onChange={(e) => handleUpdateVocabulary(i, 'word', e.target.value)}
                              onBlur={handleSaveVocabularyList}
                              className="flex-[4] min-w-0 p-0.5 text-[11px] font-bold text-[#4A3F35] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                              placeholder={t.workspace.vocabWordPlaceholder}
                            />
                            <input 
                              type="text" 
                              value={v.reading} 
                              onChange={(e) => handleUpdateVocabulary(i, 'reading', e.target.value)}
                              onBlur={handleSaveVocabularyList}
                              className="flex-[6] min-w-0 p-0.5 text-[9px] text-[#8C7A6B] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                              placeholder={t.workspace.vocabReadingPlaceholder}
                            />
                          </div>
                          <input 
                            type="text" 
                            value={v.meaning} 
                            onChange={(e) => handleUpdateVocabulary(i, 'meaning', e.target.value)}
                            onBlur={handleSaveVocabularyList}
                            className="w-full p-0.5 text-[10px] text-[#5C4D43] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                            placeholder={t.workspace.vocabMeaningPlaceholder}
                          />
                        </div>
                        <button 
                          className="text-[#8C7A6B] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          onClick={() => handleRemoveVocabulary(i)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add new row */}
                    {selectedWriting && (
                      <div className="flex gap-2 items-start bg-white p-2 rounded-xl border border-dashed border-[#D97736] relative mt-4">
                        <div className="flex-1 flex flex-col gap-1">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newVocabWord} 
                              onChange={(e) => setNewVocabWord(e.target.value)}
                              className="w-1/2 p-1 text-sm font-bold text-[#4A3F35] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                              placeholder={t.workspace.newVocabPlaceholder}
                            />
                            <input 
                              type="text" 
                              value={newVocabReading} 
                              onChange={(e) => setNewVocabReading(e.target.value)}
                              className="w-1/2 p-1 text-xs text-[#8C7A6B] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                              placeholder={t.workspace.vocabReadingPlaceholder}
                            />
                          </div>
                          <input 
                            type="text" 
                            value={newVocabMeaning} 
                            onChange={(e) => setNewVocabMeaning(e.target.value)}
                            className="w-full p-1 text-sm text-[#5C4D43] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                            placeholder={t.quiz.expandMeaning}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleManualAddVocabulary();
                              }
                            }}
                          />
                        </div>
                        <button 
                          className="text-[#D97736] hover:bg-[#FFF8F3] rounded-full p-1"
                          onClick={handleManualAddVocabulary}
                          disabled={!newVocabWord}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    {(!selectedWriting?.vocabularyList || selectedWriting.vocabularyList.length === 0) && !selectedWriting && (
                      <div className="h-full flex items-center justify-center p-6 border border-dashed border-[#E8D5C8] rounded-2xl text-center">
                        <p className="text-sm text-[#8C7A6B]">{t.workspace.noVocab}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Question Window */}
              <Card className="flex-1 flex flex-col overflow-hidden border border-[#F3E8E0] p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Badge color="orange" className="mb-2"><MessageCircle className="w-3 h-3 inline mr-1"/> Ask about text</Badge>
                    <h3 className="text-sm font-bold text-[#4A3F35]">{t.workspace.questions}</h3>
                    <p className="text-[10px] text-[#8C7A6B] mt-1">{t.workspace.questionsDesc}</p>
                  </div>
                  <Button variant="outline" size="sm" className="px-3 py-1.5" onClick={() => setIsRightSidebarOpen(false)}><ChevronRight className="w-4 h-4"/> {t.common.fold}</Button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                  {selectedWriting?.qaList && selectedWriting.qaList.length > 0 ? (
                    <div className="space-y-4">
                      {selectedWriting.qaList.map((qa, i) => (
                        <div key={i} className="space-y-2 relative group">
                          <button 
                            className="absolute top-2 right-2 text-[#8C7A6B] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10 bg-[#FDFBF7] rounded-full"
                            onClick={() => handleRemoveQa(i)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="bg-[#FDFBF7] border border-[#F3E8E0] rounded-2xl p-3">
                            <p className="text-xs text-[#8C7A6B] mb-1">{t.workspace.targetLabel}: "{qa.text}"</p>
                            <p className="text-sm font-bold text-[#4A3F35]">Q: {qa.q}</p>
                          </div>
                          <div className="bg-[#FFF8F3] border border-[#E8D5C8] rounded-2xl p-3 ml-4">
                            {isTeacher ? (
                              <textarea
                                value={qa.a}
                                onChange={(e) => handleUpdateQa(i, 'a', e.target.value)}
                                onBlur={handleSaveQaList}
                                className="w-full text-sm text-[#5C4D43] bg-transparent border-none focus:ring-0 outline-none resize-y min-h-[60px]"
                                placeholder={t.workspace.teacherPlaceholder}
                              />
                            ) : (
                              <p className="text-sm text-[#5C4D43] min-h-[60px] whitespace-pre-wrap italic">
                                {qa.a || (lang === 'ja' ? '先生からの回答を待っています...' : 'Waiting for teacher\'s answer...')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center p-6 border border-dashed border-[#E8D5C8] rounded-2xl text-center">
                      <p className="text-sm text-[#8C7A6B]">{t.workspace.qnaPlaceholder}</p>
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center py-2 border-l border-[#F3E8E0]">
              <Button variant="ghost" size="sm" onClick={() => setIsRightSidebarOpen(true)} className="p-2">
                <ChevronLeft className="w-5 h-5 text-[#8C7A6B]" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const QuizGenerator = ({ user, userProfile, setCurrentView, writings, articles = [], setWritings, setArticles, isProcessing, setIsProcessing, lang }: any) => {
    const t = TRANSLATIONS[lang as Language];
    const isTeacher = userProfile?.role === 'teacher';
    const generateQuiz = async (topic: string, level: string) => {
    setIsProcessing(true);
    try {
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: `トピック「${topic}」、JLPTレベル「${level}」に基づいた復習用クイズを3問作成してください。4択形式で、正解のインデックス（0-3）と解説も含めてください。JSON形式で出力してください。形式：{"questions": [{"question": "問題文", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "解説"}]}`,
        config: { responseMimeType: "application/json" }
      });
      let text = response.text || '{"questions": []}';
      text = text.replace(/^```json\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();
      return JSON.parse(text);
    } catch (err) {
      console.error(err);
      return { questions: [] };
    } finally {
      setIsProcessing(false);
    }
  };

    const [topic, setTopic] = useState('');
    const [level, setLevel] = useState('N3');
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<number[]>([]);
    const [showResults, setShowResults] = useState(false);

    // Memory Bank mode states
    const [tab, setTab] = useState<'ai' | 'memory'>('ai');
    const [selectedWritingIds, setSelectedWritingIds] = useState<string[]>([]);
    const [testSet, setTestSet] = useState<any[]>([]);
    const [testState, setTestState] = useState<'select' | 'testing' | 'finished'>('select');
    const [currentVocabIndex, setCurrentVocabIndex] = useState(0);
    const [userMeaningInput, setUserMeaningInput] = useState('');
    const [testFeedback, setTestFeedback] = useState<{status: 'correct'|'partial'|'incorrect', feedback: string} | null>(null);
    const [exampleSentence, setExampleSentence] = useState('');
    const [expandedWritingId, setExpandedWritingId] = useState<string | null>(null);

    useEffect(() => {
      if (!isTeacher && tab === 'ai') {
        setTab('memory');
      }
    }, [isTeacher]);

    const itemsWithVocab = useMemo(() => {
      const formattedArticles = articles.map((a: Article) => ({
        ...a,
        title: a.topic || (lang === 'ja' ? 'AI記事: ' : 'AI Article: ') + a.rewrittenText.substring(0, 15) + "...",
        isArticle: true
      }));
      return [...writings, ...formattedArticles].filter(item => item.vocabularyList && item.vocabularyList.length > 0);
    }, [writings, articles, lang]);

    const currentTestItem = testSet[currentVocabIndex];

    const toggleSelection = (id: string) => {
      setSelectedWritingIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const startAggregatedMemoryTest = () => {
      if (selectedWritingIds.length === 0) return;
      const newTestSet: any[] = [];
      itemsWithVocab.forEach((w: any) => {
        if (selectedWritingIds.includes(w.id) && w.vocabularyList) {
          w.vocabularyList.forEach((v: any, idx: number) => {
            newTestSet.push({
              writingId: w.id,
              writingTitle: w.title,
              isArticle: w.isArticle, // NEW FLAG
              vocabIndex: idx,
              word: v.word,
              reading: v.reading,
              meaning: v.meaning,
              example: v.example
            });
          });
        }
      });
      setTestSet(newTestSet);
      setCurrentVocabIndex(0);
      resetTestInput();
      setTestState('testing');
    };

    const evaluateMeaning = async (word: string, reading: string, correctMeaning: string, userInput: string) => {
      setIsProcessing(true);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `以下の学習者の回答が、対象となる単語の意味として合っているか判定してください。結果をJSON形式で出力してください。\n\n単語: ${word} (${reading})\n期待される意味: ${correctMeaning}\n学習者の回答: ${userInput}\n\n形式: {"status": "correct" または "partial" または "incorrect", "feedback": "フィードバックコメント（例：正解です！ / おしい！〇〇という意味も含まれます / ネイティブはこう言います）"}`,
          config: { responseMimeType: "application/json" }
        });
        let text = response.text || '{"status": "incorrect", "feedback": "エラーが発生しました"}';
        text = text.replace(/^```json\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();
        return JSON.parse(text);
      } catch (err) {
        console.error(err);
        return { status: "incorrect", feedback: "AIの判定に失敗しました。" };
      } finally {
        setIsProcessing(false);
      }
    };

    const handleGenerate = async () => {
      const data = await generateQuiz(topic, level);
      setQuiz({ id: 'temp', topic, level, questions: data.questions, authorId: user?.uid || '', createdAt: new Date() });
      setAnswers(new Array(data.questions.length).fill(-1));
      setShowResults(false);
    };

    const handleTestAnswer = async () => {
      if (!currentTestItem || !userMeaningInput) return;
      const feedback = await evaluateMeaning(currentTestItem.word, currentTestItem.reading, currentTestItem.meaning, userMeaningInput);
      setTestFeedback(feedback);
      setExampleSentence(currentTestItem.example || '');
    };

    const resetTestInput = () => {
      setUserMeaningInput('');
      setTestFeedback(null);
      setExampleSentence('');
    };

    const handleNextVocab = async () => {
      if (!currentTestItem) return;
      
      const updatedTestSet = [...testSet];
      if (exampleSentence) {
        updatedTestSet[currentVocabIndex] = { ...updatedTestSet[currentVocabIndex], example: exampleSentence };
        setTestSet(updatedTestSet);

        // Firestoreの元のドキュメント側にも保存しておく
        if (!currentTestItem.isArticle) {
          const originalWriting = writings.find((w: Writing) => w.id.toString() === currentTestItem.writingId.toString());
          if (originalWriting && originalWriting.vocabularyList) {
            const newList = [...originalWriting.vocabularyList];
            newList[currentTestItem.vocabIndex] = { ...newList[currentTestItem.vocabIndex], example: exampleSentence };
            try {
              await fetch(`/api/essays/${currentTestItem.writingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vocabulary_list: newList })
              });
              const updatedWritings = writings.map((w: any) => 
                 w.id.toString() === currentTestItem.writingId.toString() ? { ...w, vocabularyList: newList } : w
              );
              setWritings(updatedWritings);
            } catch (err) {
              console.error("Vocab update failed", err);
            }
          }
        } else {
          const originalArticle = articles.find((a: Article) => a.id.toString() === currentTestItem.writingId.toString());
          if (originalArticle && originalArticle.vocabularyList) {
            const newList = [...originalArticle.vocabularyList];
            newList[currentTestItem.vocabIndex] = { ...newList[currentTestItem.vocabIndex], example: exampleSentence };
            try {
              await fetch(`/api/articles/${currentTestItem.writingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vocabulary_list: newList })
              });

              const updatedArticles = articles.map((a: any) => 
                 a.id.toString() === currentTestItem.writingId.toString() ? { ...a, vocabularyList: newList } : a
              );
              setArticles(updatedArticles);
            } catch (err) {
              console.error("Vocab update failed", err);
            }
          }
        }
      }

      if (currentVocabIndex < testSet.length - 1) {
        setCurrentVocabIndex(currentVocabIndex + 1);
        resetTestInput();
      } else {
        setTestState('finished');
      }
    };

    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setCurrentView('dashboard')}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="text-2xl font-bold text-[#4A3F35]">{t.quiz.title}</h1>
          </div>
          <div className="flex gap-2">
            {isTeacher && <Button variant={tab === 'ai' ? 'primary' : 'ghost'} onClick={() => setTab('ai')} className="rounded-full">{t.quiz.aiTab}</Button>}
            <Button variant={tab === 'memory' ? 'primary' : 'ghost'} onClick={() => setTab('memory')} className="rounded-full">{t.quiz.memoryTab}</Button>
          </div>
        </header>

        {tab === 'ai' && (
          <>
            <Card className="p-6 border border-[#F3E8E0]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-[#5C4D43] mb-1">{t.quiz.topicLabel}</label>
              <input 
                type="text" 
                placeholder={t.quiz.topicPlaceholder} 
                className="w-full p-3 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-[#FDFBF7]"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C4D43] mb-1">{t.quiz.levelLabel}</label>
              <select 
                className="w-full p-3 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-[#FDFBF7]"
                value={level}
                onChange={e => setLevel(e.target.value)}
              >
                {['N5', 'N4', 'N3', 'N2', 'N1'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <Button variant="primary" onClick={handleGenerate} isLoading={isProcessing} disabled={!topic}>
            {t.quiz.genBtn}
          </Button>
        </Card>

        {quiz && (
          <div className="space-y-8">
            {quiz.questions.map((q, idx) => (
              <Card key={idx} className="p-6 border border-[#F3E8E0]">
                <h3 className="text-lg font-bold mb-4 text-[#4A3F35]">Q{idx + 1}. {q.question}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      disabled={showResults}
                      onClick={() => {
                        const newAnswers = [...answers];
                        newAnswers[idx] = optIdx;
                        setAnswers(newAnswers);
                      }}
                      className={cn(
                        'p-4 text-left border rounded-xl transition-all',
                        answers[idx] === optIdx ? 'bg-[#FFF8F3] border-[#D97736] text-[#D97736] font-bold' : 'border-[#F3E8E0] hover:bg-[#FDFBF7] text-[#5C4D43]',
                        showResults && optIdx === q.answerIndex && 'bg-[#FFF8F3] border-[#D97736] text-[#D97736] font-bold',
                        showResults && answers[idx] === optIdx && optIdx !== q.answerIndex && 'bg-rose-50 border-rose-300 text-rose-700'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {showResults && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-[#FDFBF7] rounded-xl border border-[#F3E8E0]">
                    <p className="font-bold text-sm mb-1 text-[#4A3F35]">{answers[idx] === q.answerIndex ? `✅ ${t.quiz.correct}` : `❌ ${t.quiz.incorrect}`}</p>
                    <p className="text-sm text-[#8C7A6B]">{q.explanation}</p>
                  </motion.div>
                )}
              </Card>
            ))}
            {!showResults && <Button variant="primary" className="w-full" onClick={() => setShowResults(true)}>{t.quiz.checkBtn}</Button>}
          </div>
        )}
        </>
        )}

        {tab === 'memory' && (
          <div className="space-y-6">
            {testState === 'select' && (
              <Card className="p-6 border border-[#F3E8E0] flex flex-col min-h-[500px]">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#4A3F35]">{t.quiz.testSelectTitle}</h2>
                    <p className="text-[#8C7A6B] text-sm mt-1">{t.quiz.testSelectDesc}</p>
                  </div>
                  <Button 
                    variant="primary" 
                    disabled={selectedWritingIds.length === 0}
                    onClick={startAggregatedMemoryTest}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    {t.quiz.testStartBtn}
                  </Button>
                </div>

                {itemsWithVocab.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#E8D5C8] rounded-xl text-[#8C7A6B] flex-1 flex items-center justify-center">
                    {t.quiz.emptyVocab}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm font-bold text-[#8C7A6B] border-b border-[#F3E8E0] bg-[#FDFBF7] rounded-t-xl items-center">
                      <div className="col-span-1 flex justify-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-[#D97736] cursor-pointer" 
                          checked={selectedWritingIds.length === itemsWithVocab.length && itemsWithVocab.length > 0}
                          onChange={(e) => setSelectedWritingIds(e.target.checked ? itemsWithVocab.map((w: any) => w.id) : [])}
                        />
                      </div>
                      <div className="col-span-2">{t.quiz.tableDate}</div>
                      <div className="col-span-5">{t.quiz.tableTitle}</div>
                      <div className="col-span-3 text-right">{t.quiz.tableCount}</div>
                      <div className="col-span-1 text-center">{t.quiz.tableDetails}</div>
                    </div>
                    <div className="space-y-2 mt-2">
                      {itemsWithVocab.map((w: any) => (
                        <div key={w.id} className="border border-[#F3E8E0] rounded-xl overflow-hidden bg-white hover:bg-[#FDFBF7] transition-all">
                          <div 
                            className={cn(
                              "grid grid-cols-12 gap-4 items-center p-3 cursor-pointer transition-colors border-l-4",
                              selectedWritingIds.includes(w.id) ? "border-l-[#D97736] bg-[#FFF8F3]" : "border-l-transparent"
                            )}
                            onClick={() => setExpandedWritingId(prev => prev === w.id ? null : w.id)}
                          >
                            <div className="col-span-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedWritingIds.includes(w.id)} 
                                onChange={() => toggleSelection(w.id)} 
                                className="w-5 h-5 accent-[#D97736] cursor-pointer" 
                              />
                            </div>
                            <div className="col-span-2 text-sm text-[#8C7A6B]">
                              {w.createdAt?.toDate ? new Date(w.createdAt.toDate()).toLocaleDateString() : (w.createdAt?.seconds ? new Date(w.createdAt.seconds * 1000).toLocaleDateString() : '')}
                            </div>
                            <div className="col-span-5 font-bold text-[#4A3F35] truncate flex items-center gap-2">
                              {w.isArticle && <Badge color="indigo" className="text-[10px] scale-90 origin-left">Article</Badge>}
                              {w.title || t.common.untitled}
                            </div>
                            <div className="col-span-3 text-right text-sm">
                              <Badge color="orange">{w.vocabularyList?.length}{lang === 'ja' ? '語' : ' words'}</Badge>
                            </div>
                            <div className="col-span-1 flex justify-center items-center">
                              <ChevronDown className={cn("w-5 h-5 text-[#8C7A6B] transition-transform", expandedWritingId === w.id ? "rotate-180" : "")} />
                            </div>
                          </div>
                          
                          <AnimatePresence>
                            {expandedWritingId === w.id && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: "auto", opacity: 1 }} 
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-[#F3E8E0] bg-[#FDFBF7]"
                              >
                                <div className="p-4">
                                  <div className="grid grid-cols-12 gap-4 text-xs font-bold text-[#8C7A6B] mb-2 px-2">
                                    <div className="col-span-3">{t.quiz.expandWordReading}</div>
                                    <div className="col-span-3">{t.quiz.expandMeaning}</div>
                                    <div className="col-span-6">{t.quiz.expandExample}</div>
                                  </div>
                                  <div className="space-y-2">
                                    {w.vocabularyList?.map((v, idx) => (
                                      <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-white p-3 rounded-lg border border-[#E8D5C8]">
                                        <div className="col-span-3">
                                          <div className="font-bold text-[#4A3F35]">{v.word}</div>
                                          <div className="text-[10px] text-[#8C7A6B]">{v.reading}</div>
                                        </div>
                                        <div className="col-span-3 text-sm text-[#5C4D43]">{v.meaning}</div>
                                        <div className="col-span-6 text-sm text-[#4A3F35] italic">
                                          {v.example ? (
                                            <span>{v.example}</span>
                                          ) : (
                                            <span className="text-[#8C7A6B] opacity-60">{t.quiz.noExample}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {testState === 'testing' && currentTestItem && (
              <div className="max-w-2xl mx-auto">
                <Card className="p-8 border border-[#F3E8E0] relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1 bg-[#D97736] transition-all" style={{ width: `${((currentVocabIndex+1)/testSet.length)*100}%` }} />
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-[#8C7A6B]">{t.quiz.questionNum(currentVocabIndex + 1, testSet.length)}</span>
                    <Badge color="orange" className="text-xs max-w-[200px] truncate">{t.quiz.targetWriting(currentTestItem.writingTitle)}</Badge>
                  </div>
                  
                  <div className="text-center mb-8">
                    <p className="text-[#8C7A6B] text-sm mb-1">{currentTestItem.reading}</p>
                    <h2 className="text-4xl font-bold text-[#4A3F35]">{currentTestItem.word}</h2>
                  </div>

                  {!testFeedback ? (
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-[#5C4D43]">{t.quiz.meaningLabel}</label>
                      <input 
                        type="text" 
                        value={userMeaningInput}
                        onChange={(e) => setUserMeaningInput(e.target.value)}
                        placeholder={t.quiz.meaningPlaceholder}
                        className="w-full p-4 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-[#FDFBF7] text-lg"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleTestAnswer(); }}
                      />
                      <Button variant="primary" className="w-full py-3" onClick={handleTestAnswer} isLoading={isProcessing} disabled={!userMeaningInput}>{t.quiz.checkBtn}</Button>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className={cn(
                        "p-4 rounded-xl border flex gap-3",
                        testFeedback.status === 'correct' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                        testFeedback.status === 'partial' ? "bg-amber-50 border-amber-200 text-amber-800" :
                        "bg-rose-50 border-rose-200 text-rose-800"
                      )}>
                        <div>
                          {testFeedback.status === 'correct' && <CheckCircle2 className="w-5 h-5 mt-0.5" />}
                          {testFeedback.status === 'partial' && <HelpCircle className="w-5 h-5 mt-0.5" />}
                          {testFeedback.status === 'incorrect' && <AlertCircle className="w-5 h-5 mt-0.5" />}
                        </div>
                        <div>
                          <p className="font-bold mb-1">
                            {testFeedback.status === 'correct' ? t.quiz.correct : testFeedback.status === 'partial' ? t.quiz.partial : t.quiz.incorrect}
                          </p>
                          <p className="text-sm">{testFeedback.feedback}</p>
                          <p className="text-sm mt-2 font-medium opacity-80">{t.quiz.modelAnswer(currentTestItem.meaning)}</p>
                        </div>
                      </div>

                      <div className="bg-[#FDFBF7] p-6 rounded-xl border border-[#F3E8E0]">
                        <h3 className="font-bold text-[#4A3F35] mb-2">{t.quiz.sentenceTitle}</h3>
                        <p className="text-xs text-[#8C7A6B] mb-4">{t.quiz.sentenceDesc(currentTestItem.word)}</p>
                        <textarea
                          className="w-full p-3 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-white resize-none text-sm"
                          rows={2}
                          placeholder={t.quiz.sentencePlaceholder(currentTestItem.word)}
                          value={exampleSentence}
                          onChange={(e) => setExampleSentence(e.target.value)}
                        />
                      </div>

                      <Button variant="primary" className="w-full py-3" onClick={handleNextVocab}>
                        {currentVocabIndex < testSet.length - 1 ? t.quiz.nextBtn : t.quiz.finishBtn}
                      </Button>
                    </motion.div>
                  )}
                </Card>
              </div>
            )}

            {testState === 'finished' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <Card className="p-8 border border-[#F3E8E0]">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#4A3F35] mb-2">{t.quiz.completedTitle}</h2>
                    <p className="text-[#8C7A6B]">{t.quiz.completedDesc(testSet.length)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-[#8C7A6B] border-b border-[#F3E8E0]">
                      <div className="col-span-3">{t.quiz.resultWord}</div>
                      <div className="col-span-3">{t.quiz.resultMeaning}</div>
                      <div className="col-span-6">{t.quiz.resultSentence}</div>
                    </div>
                    
                    <div className="space-y-3">
                      {testSet.map((v, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-[#FDFBF7] border border-[#F3E8E0] rounded-xl">
                          <div className="col-span-3">
                            <div className="font-bold text-[#4A3F35] text-lg">{v.word}</div>
                            <div className="text-xs text-[#8C7A6B]">{v.reading}</div>
                            <div className="text-[10px] text-[#D97736] mt-1 bg-[#FFF8F3] inline-block px-1.5 py-0.5 rounded truncate max-w-[120px]">{v.writingTitle}</div>
                          </div>
                          <div className="col-span-3 text-sm text-[#5C4D43]">{v.meaning}</div>
                          <div className="col-span-6 text-sm text-[#4A3F35] bg-white p-3 rounded-lg border border-[#E8D5C8] italic shadow-sm relative">
                            {v.example ? (
                              <>
                                <span className="absolute -left-2 top-3 w-4 h-4 bg-[#FFF8F3] border-l border-b border-[#E8D5C8] transform rotate-45"></span>
                                <span className="relative z-10">{v.example}</span>
                              </>
                            ) : (
                              <span className="text-[#8C7A6B]">{t.quiz.notEntered}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center">
                    <Button variant="outline" onClick={() => { setTestState('select'); setSelectedWritingIds([]); }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> {t.quiz.backToSelection}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

      </div>
    );
  };

  const ArticleGenerator = ({ user, userProfile, articles, setArticles, setCurrentView, isProcessing, setIsProcessing, lang, targetEmail }: any) => {
    const t = TRANSLATIONS[lang as Language];
    const isTeacher = userProfile?.role === 'teacher';
    const [topic, setTopic] = useState('');
    const [level, setLevel] = useState('N3');
    const [result, setResult] = useState('');
    const [furiganaResult, setFuriganaResult] = useState('');
    const [showFurigana, setShowFurigana] = useState(false);
    const [vocabularyList, setVocabularyList] = useState<{ word: string; reading: string; meaning: string }[]>([]);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [newVocab, setNewVocab] = useState({ word: '', reading: '', meaning: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [selection, setSelection] = useState('');
    const [popupMode, setPopupMode] = useState<'menu' | 'question' | 'translation'>('menu');
    const [translationResult, setTranslationResult] = useState('');
    const [question, setQuestion] = useState('');
    const [isAsking, setIsAsking] = useState(false);

    const handleTextSelection = () => {
      const activeEl = document.activeElement;
      const isTextArea = activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT');

      // Use setTimeout to ensure selection is captured after mouseup event completes
      setTimeout(() => {
        if (isTextArea) {
          const input = activeEl as HTMLTextAreaElement | HTMLInputElement;
          const text = input.value.substring(input.selectionStart || 0, input.selectionEnd || 0).trim();
          if (text) {
            setSelection(text);
            setPopupMode('menu');
            setTranslationResult('');
            setQuestion('');
          } else {
            setSelection('');
          }
          return;
        }

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.toString().trim() !== '') {
          const range = sel.getRangeAt(0);
          const frag = range.cloneContents();
          
          // Helper div to extract text content
          const div = document.createElement('div');
          div.appendChild(frag);
          
          // Remove all furigana (ruby text) elements so they don't get included in the selection string
          const rtElements = div.querySelectorAll('rt');
          rtElements.forEach(rt => rt.remove());
          
          const rpElements = div.querySelectorAll('rp');
          rpElements.forEach(rp => rp.remove());

          const text = div.textContent?.trim() || '';
          
          if (text) {
            setSelection(text);
            setPopupMode('menu');
            setTranslationResult('');
            setQuestion('');
          } else {
            setSelection('');
          }
        } else {
          setSelection('');
        }
      }, 10);
    };

    const handleCopy = () => {
      if (selection) {
        navigator.clipboard.writeText(selection);
        setSelection('');
      }
    };

    const handleTranslate = async () => {
      if (!selection) return;
      setPopupMode('translation');
      setIsProcessing(true);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `以下のテキストを翻訳してください。日本語の場合は英語に、英語の場合は日本語に翻訳してください。\n\nテキスト: "${selection}"`,
        });
        setTranslationResult(response.text || "翻訳できませんでした。");
      } catch (err) {
        console.error(err);
        setTranslationResult("エラーが発生しました。");
      } finally {
        setIsProcessing(false);
      }
    };

    const handleAddVocabulary = async () => {
      if (!selection) return;
      setIsProcessing(true);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `以下の選択されたテキストから、対象となる単語（ふりがなが含まれている場合はふりがなを除いた漢字のみ）、その「よみがな」、および「英語の意味」を抽出してJSON形式で出力してください。\n\n選択テキスト: ${selection}`,
          config: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING, description: "単語（ふりがななし）" },
                reading: { type: Type.STRING, description: "よみがな" },
                meaning: { type: Type.STRING, description: "英語の意味" }
              },
              required: ["word", "reading", "meaning"]
            }
          }
        });
        let text = response.text || `{"word": "${selection}", "reading": "", "meaning": ""}`;
        text = text.replace(/^```json\n?/gi, '').replace(/^```\n?/g, '').replace(/\n?```$/g, '').trim();
        let vocab = JSON.parse(text);
        if (Array.isArray(vocab)) {
          vocab = vocab[0];
        }
        
        const newList = [...vocabularyList, vocab];
        setVocabularyList(newList);
        setSelection('');
        
        if (selectedArticleId) {
          fetch(`/api/articles/${selectedArticleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabulary_list: newList })
          }).then(res => {
            if (res.ok) {
              setArticles(articles.map((a: Article) => a.id.toString() === selectedArticleId.toString() ? { ...a, vocabularyList: newList } : a));
            }
          });
        }
      } catch (err) {
        console.error(err);
        const newList = [...vocabularyList, { word: selection, reading: '', meaning: '' }];
        setVocabularyList(newList);
        setSelection('');
        if (selectedArticleId) {
          fetch(`/api/articles/${selectedArticleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabulary_list: newList })
          }).then(res => {
            if (res.ok) {
              setArticles(articles.map((a: Article) => a.id.toString() === selectedArticleId.toString() ? { ...a, vocabularyList: newList } : a));
            }
          });
        }
      } finally {
        setIsProcessing(false);
      }
    };

    const extractTitle = (text: string) => {
      if (!text) return '';
      const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        // Strip Markdown and common intros if any (though prompt should handle it)
        return lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').replace(/[:：]$/, '');
      }
      return '';
    };

    const generateArticle = async (topic: string, level: string) => {
      setIsProcessing(true);
      setFuriganaResult('');
      setShowFurigana(false);
      try {
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: t.rewrite.genPrompt(topic, level),
        });
        return response.text || "";
      } catch (err) {
        console.error(err);
        return "";
      } finally {
        setIsProcessing(false);
      }
    };

    const [streamingFurigana, setStreamingFurigana] = useState<string | null>(null);

    const handleFurigana = async () => {
      if (!result || isProcessing || (furiganaResult && !streamingFurigana)) {
        if (furiganaResult) setShowFurigana(true);
        return;
      }
      setIsProcessing(true);
      setStreamingFurigana('');
      try {
        // Strip Markdown on client side to reduce AI reasoning/tokens
        const cleanedText = result
          .replace(/#+\s/g, '')
          .replace(/\*\*?([^*]+)\*\*?/g, '$1')
          .replace(/`([^`]+)`/g, '$1');

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-3.1-flash-lite-preview",
          contents: `以下の日本語の文章の「漢字」にのみ、HTMLの<ruby>タグ（例：<ruby>明日<rt>あした</rt></ruby>）でふりがなを振ってください。
重要：
1. 元の文章にある文字（ひらがな、カタカナ、記号、英数字など）は一切変更しないでください。ひらがなを漢字に変換することは絶対に禁止です。
2. 漢字以外の文字はそのままで、既存の漢字のみをrubyタグで囲んでください。
3. 元の改行、段落構成、空白などは、一切変更せずそのまま保持してください。
4. 出力はHTML（rubyタグ付きテキスト）のみとし、説明などは一切含めないでください。\n\n${cleanedText}`,
        });

        let fullText = "";
        for await (const chunk of responseStream) {
          const chunkText = (chunk as any).text || "";
          fullText += chunkText;
          setStreamingFurigana(fullText);
        }

        setFuriganaResult(fullText);
        setShowFurigana(true);
        setStreamingFurigana(null);
      } catch (err) {
        console.error("Furigana Error:", err);
      } finally {
        setIsProcessing(false);
      }
    };

    const handleGenerate = async () => {
      const generated = await generateArticle(topic, level);
      setResult(generated);
      setFuriganaResult('');
      setShowFurigana(false);
      setSelectedArticleId(null);
      setVocabularyList([]);
    };

    const handleSave = async () => {
      if (!result || !user) return;
      setIsSaving(true);
      try {
        const payload = {
          author_email: targetEmail || user.email,
          rewritten_text: result,
          level,
          topic: extractTitle(result) || topic,
          vocabulary_list: vocabularyList
        };

        if (selectedArticleId) {
          const res = await fetch(`/api/articles/${selectedArticleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const updatedArticle = {
              id: selectedArticleId,
              rewrittenText: result,
              level,
              topic: extractTitle(result) || topic,
              vocabularyList,
              authorId: targetEmail || user.email,
              createdAt: articles.find(a => a.id.toString() === selectedArticleId.toString())?.createdAt || { toDate: () => new Date() }
            } as Article;
            setArticles(articles.map(a => a.id.toString() === selectedArticleId.toString() ? updatedArticle : a));
            alert(lang === 'ja' ? "更新されました！" : "Updated successfully!");
          }
        } else {
          const res = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const { id } = await res.json();
            const newArticle = {
              id: id.toString(),
              rewrittenText: result,
              level,
              topic: extractTitle(result) || topic,
              vocabularyList,
              authorId: targetEmail || user.email,
              createdAt: { toDate: () => new Date() }
            } as Article;
            setArticles([newArticle, ...articles]);
            setSelectedArticleId(id.toString());
            alert(lang === 'ja' ? "保存されました！" : "Saved successfully!");
          }
        }
      } catch (err) {
        console.error("Save failed", err);
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await fetch(`/api/articles/${id}`, { method: 'DELETE' });
        setArticles(articles.filter(a => a.id !== id));
      } catch (err) {
        console.error("Delete failed", err);
      }
    };

    const handleUpdateVocabulary = (index: number, field: string, value: string) => {
      const newList = [...vocabularyList];
      newList[index] = { ...newList[index], [field]: value } as any;
      setVocabularyList(newList);
      
      if (selectedArticleId) {
        fetch(`/api/articles/${selectedArticleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: newList })
        }).then(res => {
          if (res.ok) {
            setArticles(articles.map((a: Article) => a.id.toString() === selectedArticleId.toString() ? { ...a, vocabularyList: newList } : a));
          }
        });
      }
    };

    const addVocab = () => {
      if (!newVocab.word) return;
      const newList = [...vocabularyList, newVocab];
      setVocabularyList(newList);
      setNewVocab({ word: '', reading: '', meaning: '' });
      
      if (selectedArticleId) {
        fetch(`/api/articles/${selectedArticleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: newList })
        }).then(res => {
          if (res.ok) {
            setArticles(articles.map((a: Article) => a.id.toString() === selectedArticleId.toString() ? { ...a, vocabularyList: newList } : a));
          }
        });
      }
    };

    const removeVocab = (index: number) => {
      const newList = vocabularyList.filter((_, i) => i !== index);
      setVocabularyList(newList);
      
      if (selectedArticleId) {
        fetch(`/api/articles/${selectedArticleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vocabulary_list: newList })
        }).then(res => {
          if (res.ok) {
            setArticles(articles.map((a: Article) => a.id.toString() === selectedArticleId.toString() ? { ...a, vocabularyList: newList } : a));
          }
        });
      }
    };

    const loadArticle = (article: Article) => {
      setSelectedArticleId(article.id.toString());
      setResult(article.rewrittenText);
      setTopic(article.topic || '');
      setLevel(article.level);
      setVocabularyList(article.vocabularyList || []);
      setFuriganaResult('');
      setShowFurigana(false);
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <header className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setCurrentView('dashboard')}><ArrowLeft className="w-4 h-4" /></Button>
          <h1 className="text-2xl font-bold text-[#4A3F35]">{t.rewrite.title}</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Area: Input & Output */}
          <div className="lg:col-span-2 space-y-6">
            {isTeacher && (
              <Card className="p-6 border border-[#F3E8E0] shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1 tracking-wider">{t.rewrite.genTopicLabel}</label>
                    <input 
                      type="text"
                      placeholder={t.rewrite.genTopicPlaceholder}
                      className="w-full max-w-md p-2.5 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-[#FDFBF7] text-sm"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-0 md:pt-4">
                    <select 
                      className="p-2 border border-[#F3E8E0] rounded-xl outline-none focus:ring-2 focus:ring-[#D97736] bg-[#FDFBF7] text-sm"
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                    >
                      {['N5', 'N4', 'N3', 'N2', 'N1'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <Button variant="primary" onClick={handleGenerate} isLoading={isProcessing} disabled={!topic} size="sm">
                      {t.rewrite.genBtn}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-0 border border-[#F3E8E0] shadow-sm flex flex-col min-h-[500px] overflow-hidden">
              <div className="p-4 border-b border-[#F3E8E0] bg-[#FFF8F3]/50 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-[#4A3F35] text-sm">{t.rewrite.resultTitle} ({level})</h3>
                  {result && (
                    <span className="text-[11px] font-bold text-[#D97736] bg-[#D97736]/10 px-3 py-1 rounded-full animate-fade-in border border-[#D97736]/20 break-all">
                      {extractTitle(result)}
                    </span>
                  )}
                </div>
                {result && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#8C7A6B] flex items-center gap-1"><Languages className="w-4 h-4"/> {t.workspace.furigana}</span>
                    <div className="flex bg-[#FFF8F3] p-1 rounded-xl border border-[#F3E8E0]">
                      <button 
                        className={cn("px-4 py-1 rounded-lg text-sm font-bold transition-colors", showFurigana ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                        onClick={handleFurigana}
                        disabled={isProcessing}
                      >
                        {t.workspace.on}
                      </button>
                      <button 
                        className={cn("px-4 py-1 rounded-lg text-sm font-bold transition-colors", !showFurigana ? "bg-white text-[#D97736] shadow-sm border border-[#F3E8E0]" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
                        onClick={() => setShowFurigana(false)}
                        disabled={isProcessing}
                      >
                        {t.workspace.off}
                      </button>
                    </div>
                    {isProcessing && result && !showFurigana && <Loader2 className="w-4 h-4 text-[#D97736] animate-spin" />}
                    <Button variant="soft" size="sm" onClick={handleSave} isLoading={isSaving} className="h-8">
                      <Save className="w-3 h-3 mr-1" /> {t.rewrite.saveBtn}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white relative" onMouseUp={handleTextSelection}>
                <div className={cn(
                  "prose prose-stone max-w-none prose-headings:text-[#4A3F35] prose-p:text-[#4A3F35] prose-strong:text-[#D97736]",
                  showFurigana && "furigana-content"
                )}>
                  {result ? (
                    (showFurigana && furiganaResult) || streamingFurigana ? (
                      <div dangerouslySetInnerHTML={{ __html: streamingFurigana || furiganaResult }} className="leading-[2.5] whitespace-pre-wrap" />
                    ) : (
                      <Markdown>{result}</Markdown>
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#8C7A6B] italic py-20">
                      {t.rewrite.emptyResult}
                    </div>
                  )}
                </div>

                {/* Floating Action for Vocabulary (WritingWorkspace style) */}
                <AnimatePresence>
                  {selection && result && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-2xl p-4 flex flex-col gap-3 border border-[#F3E8E0] min-w-[320px] z-50"
                      onMouseDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-[#4A3F35] px-1 truncate max-w-[250px]">{lang === 'ja' ? '選択' : 'Selection'}: "{selection}"</span>
                        <button onClick={() => setSelection('')} className="text-[#8C7A6B] hover:text-[#4A3F35]"><X className="w-4 h-4"/></button>
                      </div>
                      
                      {popupMode === 'menu' && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={handleTranslate} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                            <Globe className="w-4 h-4 mr-1" /> {lang === 'ja' ? '翻訳' : 'Translate'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleAddVocabulary} isLoading={isProcessing} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                            <Plus className="w-4 h-4 mr-1" /> {lang === 'ja' ? '記憶バンクへ' : 'Add to Bank'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-full flex-1 bg-[#FFF8F3] border-[#F3E8E0] hover:bg-[#F3E8E0] text-[#4A3F35]">
                            <Copy className="w-4 h-4 mr-1" /> {lang === 'ja' ? 'コピー' : 'Copy'}
                          </Button>
                        </div>
                      )}

                      {popupMode === 'translation' && (
                        <div className="bg-[#FDFBF7] p-3 rounded-xl border border-[#F3E8E0] text-sm text-[#4A3F35]">
                          {isProcessing ? <div className="flex items-center gap-2 text-[#8C7A6B]"><Loader2 className="w-4 h-4 animate-spin"/> {lang === 'ja' ? '翻訳中...' : 'Translating...'}</div> : translationResult}
                          {!isProcessing && (
                            <div className="mt-2 flex justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setPopupMode('menu')} className="text-xs h-6 px-2">{lang === 'ja' ? '戻る' : 'Back'}</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </div>

          {/* Sidebar: Memory Bank */}
          <div className="space-y-6">
            <Card className="p-6 border border-[#F3E8E0] shadow-sm flex flex-col h-full bg-[#FFF8F3]/20">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-5 h-5 text-[#D97736]" />
                <h3 className="text-lg font-bold text-[#4A3F35]">{t.rewrite.memoryBank}</h3>
              </div>
              <p className="text-xs text-[#8C7A6B] mb-4">{t.rewrite.memoryBankDesc}</p>
              
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder={t.rewrite.vocabWord}
                    className="p-2 border border-[#F3E8E0] rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-[#D97736]"
                    value={newVocab.word}
                    onChange={e => setNewVocab({...newVocab, word: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder={t.rewrite.vocabReading}
                    className="p-2 border border-[#F3E8E0] rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-[#D97736]"
                    value={newVocab.reading}
                    onChange={e => setNewVocab({...newVocab, reading: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={t.rewrite.vocabMeaning}
                    className="flex-1 p-2 border border-[#F3E8E0] rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-[#D97736]"
                    value={newVocab.meaning}
                    onChange={e => setNewVocab({...newVocab, meaning: e.target.value})}
                  />
                  <Button variant="outline" size="sm" onClick={addVocab} disabled={!newVocab.word}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                <div className="space-y-2">
                  {vocabularyList.map((v, i) => (
                    <div key={i} className="flex gap-1.5 items-start bg-white p-2 rounded-xl border border-[#F3E8E0] relative group shadow-sm transition-all hover:border-[#D97736]/50">
                      <div className="flex-1 flex flex-col gap-0">
                        <div className="flex items-baseline gap-2">
                          <input 
                            type="text" 
                            value={v.word} 
                            onChange={(e) => handleUpdateVocabulary(i, 'word', e.target.value)}
                            className="flex-[4] min-w-0 p-0.5 text-[11px] font-bold text-[#4A3F35] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                            placeholder={t.rewrite.vocabWord}
                          />
                          <input 
                            type="text" 
                            value={v.reading} 
                            onChange={(e) => handleUpdateVocabulary(i, 'reading', e.target.value)}
                            className="flex-[6] min-w-0 p-0.5 text-[9px] text-[#8C7A6B] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                            placeholder={t.rewrite.vocabReading}
                          />
                        </div>
                        <input 
                          type="text" 
                          value={v.meaning} 
                          onChange={(e) => handleUpdateVocabulary(i, 'meaning', e.target.value)}
                          className="w-full p-0.5 text-[10px] text-[#5C4D43] bg-transparent border-b border-transparent focus:border-[#D97736] outline-none"
                          placeholder={t.rewrite.vocabMeaning}
                        />
                      </div>
                      <button 
                        onClick={() => removeVocab(i)} 
                        className="w-5 h-5 flex items-center justify-center rounded-full text-[#E8D5C8] hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm bg-white border border-[#F3E8E0]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {vocabularyList.length === 0 && (
                    <div className="py-8 text-center text-[#8C7A6B] italic text-xs border-2 border-dashed border-[#F3E8E0] rounded-xl bg-white/50">
                      {lang === 'ja' ? '記録した語彙はありません' : 'No recorded vocabulary'}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* History Section below */}
        <section className="pt-12">
          <h2 className="text-xl font-bold mb-6 text-[#4A3F35] flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-[#D97736]" />
            {t.rewrite.historyTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {articles.map((article: Article) => (
              <Card 
                key={article.id} 
                onClick={() => loadArticle(article)}
                className="p-5 border border-[#F3E8E0] hover:border-[#D97736] transition-all group relative cursor-pointer bg-white flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <Badge color="orange">{article.level}</Badge>
                    <button onClick={(e) => handleDelete(article.id, e)} className="text-[#E8D5C8] hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-[#4A3F35] line-clamp-2 mb-2 group-hover:text-[#D97736] transition-colors">
                    {article.topic || "Untitled"}
                  </h4>
                  <p className="text-xs text-[#8C7A6B] line-clamp-2 leading-relaxed mb-4">{article.rewrittenText.substring(0, 80).replace(/[#*`]/g, '')}...</p>
                  {article.vocabularyList && article.vocabularyList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.vocabularyList.slice(0, 3).map((v, i) => (
                        <span key={i} className="text-[10px] bg-[#FFF8F3] text-[#D97736] px-1.5 py-0.5 rounded-md border border-[#FFEFE3] font-medium">
                          {v.word}
                        </span>
                      ))}
                      {article.vocabularyList.length > 3 && (
                        <span className="text-[10px] text-[#8C7A6B] flex items-center">
                          +{article.vocabularyList.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-[#8C7A6B] font-mono border-t border-[#F3E8E0] pt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Bookmark className="w-3 h-3" />
                    {article.createdAt?.toDate 
                      ? new Date(article.createdAt.toDate()).toLocaleDateString() 
                      : article.createdAt?.seconds 
                        ? new Date(article.createdAt.seconds * 1000).toLocaleDateString()
                        : new Date().toLocaleDateString()
                    }
                  </span>
                  <Eye className="w-3 h-3" />
                </div>
              </Card>
            ))}
            {articles.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-[#F3E8E0] rounded-2xl">
                <p className="text-[#8C7A6B]">{t.rewrite.noHistory}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };


interface SimpleUser {
  email: string;
  displayName: string;
  photoURL?: string;
}

export default function App() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [writings, setWritings] = useState<Writing[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedWriting, setSelectedWriting] = useState<Writing | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('ja');
  const [loginEmail, setLoginEmail] = useState('');

  // Teacher-specific state
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState<string | null>(null);

  // Auth Integration with SQLite Users
  useEffect(() => {
    const savedUser = localStorage.getItem('nihongo_session');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      loadUserProfile(u.email);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserProfile = async (email: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/${email.toLowerCase().trim()}`);
      if (res.ok) {
        const profile = await res.json();
        setUserProfile(profile);
        const simpleUser = { email: profile.email, displayName: profile.name };
        setUser(simpleUser);
        localStorage.setItem('nihongo_session', JSON.stringify(simpleUser));
        
        if (profile.role === 'teacher') {
          const sRes = await fetch('/api/students');
          if (sRes.ok) setStudents(await sRes.json());
          setCurrentView('dashboard');
        } else {
          setSelectedStudentEmail(profile.email);
          setCurrentView('dashboard');
        }
        setError(null);
      } else {
        setError(language === 'ja' ? "登録されていないメールアドレスです。" : "Email not found in our records.");
      }
    } catch (err) {
      console.error("Auth sync error:", err);
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail) return;
    setIsProcessing(true);
    await loadUserProfile(loginEmail.toLowerCase().trim());
    setIsProcessing(false);
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    localStorage.removeItem('nihongo_session');
    setCurrentView('dashboard');
  };

  // Fetch Writings & Articles
  useEffect(() => {
    if (!user || !userProfile) return;
    
    const targetEmail = userProfile.role === 'teacher' ? (selectedStudentEmail || user.email) : user.email;
    if (!targetEmail) return;

    const loadData = async () => {
      try {
        const wRes = await fetch(`/api/essays/${targetEmail}`);
        if (wRes.ok) {
          const rawWritings = await wRes.json();
          setWritings(rawWritings.map((w: any) => ({
            id: w.id.toString(),
            title: w.title,
            content: w.content,
            correctedContent: w.correction,
            feedback: w.feedback,
            furiganaContent: w.furigana_content,
            qaList: w.qa_list,
            vocabularyList: w.vocabulary_list,
            images: w.images,
            authorId: w.student_email,
            createdAt: { toDate: () => new Date(w.date) }
          })));
        }

        const aRes = await fetch(`/api/articles?email=${targetEmail}`);
        if (aRes.ok) {
          const rawArticles = await aRes.json();
          setArticles(rawArticles.map((a: any) => ({
            id: a.id.toString(),
            rewrittenText: a.rewritten_text,
            level: a.level,
            topic: a.topic,
            vocabularyList: a.vocabulary_list,
            authorId: a.author_email,
            createdAt: { toDate: () => new Date(a.created_at) }
          })));
        }
      } catch (err) {
        console.error("Data load error:", err);
      }
    };

    loadData();
  }, [user, userProfile, selectedStudentEmail]);

  // --- Gemini Functions ---









  // --- Views ---









  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="w-8 h-8 text-[#D97736] animate-spin" />
      </div>
    );
  }

  if (!user) {
    const t = TRANSLATIONS[language];
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] p-4 font-sans">
        <Card className="max-w-md w-full p-10 text-center space-y-8 border border-[#F3E8E0] relative shadow-2xl rounded-[3rem]">
          <div className="absolute top-6 right-6">
             <div className="flex bg-[#F3E8E0] p-1 rounded-full border border-[#E8D5C8]">
              <button 
                onClick={() => setLanguage('ja')}
                className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", language === 'ja' ? "bg-[#D97736] text-white shadow-md" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
              >
                JP
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", language === 'en' ? "bg-[#D97736] text-white shadow-md" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
              >
                EN
              </button>
            </div>
          </div>
          <div className="w-24 h-24 bg-[#FFF8F3] text-[#D97736] rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner border border-[#FFEFE3]">
            <Languages className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-[#4A3F35] tracking-tight">{t.login.title}</h1>
            <p className="text-[#8C7A6B] text-lg font-medium">{t.login.desc}</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#8C7A6B] uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8C7A6B]" />
                <input 
                  type="email" 
                  placeholder="your@email.com"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-[#FDFBF7] border-2 border-[#F3E8E0] rounded-3xl outline-none focus:border-[#D97736] transition-all text-[#4A3F35] font-medium"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
            <Button className="w-full py-5 text-xl rounded-3xl shadow-lg shadow-[#D97736]/20" onClick={handleLogin} isLoading={isProcessing}>
              {language === 'ja' ? 'ログイン' : 'Login'}
            </Button>
          </form>

          <p className="text-xs text-[#8C7A6B] leading-relaxed px-4">{t.login.tos}</p>
        </Card>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] p-4 text-center">
        <Card className="p-8 space-y-4">
           {error ? (
             <div className="text-red-500">
               <AlertCircle className="mx-auto mb-2" />
               {error}
               <Button variant="ghost" onClick={handleLogout} className="mt-4">Back to Login</Button>
             </div>
           ) : (
             <Loader2 className="animate-spin mx-auto text-[#D97736]" />
           )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#4A3F35] font-sans">
      <nav className="bg-[#FFF8F3] border-b border-[#F3E8E0] sticky top-0 z-10 w-full">
        <div className="w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-8 h-8 bg-[#D97736] text-white rounded-xl flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#4A3F35]">NIHONGO AI</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-[#F3E8E0] p-1 rounded-full border border-[#E8D5C8]">
              <button 
                onClick={() => setLanguage('ja')}
                className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold transition-all", language === 'ja' ? "bg-[#D97736] text-white shadow-sm" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
              >
                JP
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold transition-all", language === 'en' ? "bg-[#D97736] text-white shadow-sm" : "text-[#8C7A6B] hover:text-[#4A3F35]")}
              >
                EN
              </button>
            </div>
            <div className="w-8 h-8 bg-[#D97736] text-white rounded-full border border-[#F3E8E0] flex items-center justify-center overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className={cn("mx-auto transition-all w-full", 
        currentView === 'writing-workspace' ? 'px-2 pt-2 pb-2 h-auto md:h-[calc(100vh-56px)]' : 
        currentView === 'article-rewrite' ? 'px-4 pt-4 pb-8 max-w-7xl' :
        'px-4 pt-4 pb-8 max-w-5xl'
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={currentView === 'writing-workspace' ? 'h-full' : ''}
          >
             {currentView === 'dashboard' && (
               <Dashboard 
                 user={user} 
                 userProfile={userProfile} 
                 handleLogout={handleLogout} 
                 setCurrentView={setCurrentView} 
                 writings={writings} 
                 setSelectedWriting={setSelectedWriting} 
                 lang={language} 
                 students={students}
                 selectedStudentEmail={selectedStudentEmail}
                 setSelectedStudentEmail={setSelectedStudentEmail}
               />
             )}
            {currentView === 'writing-workspace' && (
              <WritingWorkspace 
                user={user} 
                userProfile={userProfile} 
                writings={writings} 
                setWritings={setWritings} 
                selectedWriting={selectedWriting} 
                setSelectedWriting={setSelectedWriting} 
                isProcessing={isProcessing} 
                setIsProcessing={setIsProcessing} 
                lang={language} 
              />
            )}
            {currentView === 'quiz-gen' && (
              <QuizGenerator 
                user={user} 
                userProfile={userProfile} 
                setCurrentView={setCurrentView} 
                writings={writings} 
                articles={articles} 
                setWritings={setWritings}
                setArticles={setArticles}
                isProcessing={isProcessing} 
                setIsProcessing={setIsProcessing} 
                lang={language} 
              />
            )}
            {currentView === 'article-rewrite' && (
              <ArticleGenerator 
                user={user} 
                userProfile={userProfile} 
                articles={articles} 
                setArticles={setArticles}
                setCurrentView={setCurrentView} 
                isProcessing={isProcessing} 
                setIsProcessing={setIsProcessing} 
                lang={language} 
                targetEmail={userProfile?.role === 'teacher' ? (selectedStudentEmail || user?.email) : user?.email}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="w-full mx-auto px-4 py-8 text-center text-[#8C7A6B] text-sm md:max-w-5xl">
        &copy; 2026 NIHONGO AI Assistant. Built for Japanese Teachers.
      </footer>

      {/* Global CSS for Furigana */}
      <style dangerouslySetInnerHTML={{ __html: `
        .furigana-content ruby {
          ruby-position: over;
        }
        .furigana-content rt {
          font-size: 0.5em;
          color: #D97736;
          user-select: none;
        }
      `}} />
    </div>
  );
}
