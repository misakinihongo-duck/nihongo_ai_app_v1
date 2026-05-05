const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

const dashboard = getLines(369, 423);
const writingWorkspace = getLines(425, 1116);
const quizGenerator = getLines(1118, 1206);
const articleRewriter = getLines(1208, 1262);

const generateFurigana = getLines(296, 316);
const correctWriting = getLines(318, 332);
const generateQuiz = getLines(334, 349);
const rewriteArticle = getLines(351, 365);

let newDashboard = dashboard.replace('const Dashboard = () => (', 'const Dashboard = ({ user, handleLogout, setCurrentView, writings, setSelectedWriting }: any) => (');
let newWritingWorkspace = writingWorkspace.replace('const WritingWorkspace = () => {', 'const WritingWorkspace = ({ user, writings, selectedWriting, setSelectedWriting, isProcessing, setIsProcessing }: any) => {\n' + generateFurigana + '\n');
let newQuizGenerator = quizGenerator.replace('const QuizGenerator = () => {', 'const QuizGenerator = ({ user, setCurrentView, isProcessing, setIsProcessing }: any) => {\n' + generateQuiz + '\n');
let newArticleRewriter = articleRewriter.replace('const ArticleRewriter = () => {', 'const ArticleRewriter = ({ setCurrentView, isProcessing, setIsProcessing }: any) => {\n' + rewriteArticle + '\n');

let newApp = content.replace(dashboard, '');
newApp = newApp.replace(writingWorkspace, '');
newApp = newApp.replace(quizGenerator, '');
newApp = newApp.replace(articleRewriter, '');
newApp = newApp.replace(generateFurigana, '');
newApp = newApp.replace(correctWriting, '');
newApp = newApp.replace(generateQuiz, '');
newApp = newApp.replace(rewriteArticle, '');

const appStart = newApp.indexOf('export default function App() {');
newApp = newApp.slice(0, appStart) + newDashboard + '\n\n' + newWritingWorkspace + '\n\n' + newQuizGenerator + '\n\n' + newArticleRewriter + '\n\n' + newApp.slice(appStart);

newApp = newApp.replace('<Dashboard />', '<Dashboard user={user} handleLogout={handleLogout} setCurrentView={setCurrentView} writings={writings} setSelectedWriting={setSelectedWriting} />');
newApp = newApp.replace('<WritingWorkspace />', '<WritingWorkspace user={user} writings={writings} selectedWriting={selectedWriting} setSelectedWriting={setSelectedWriting} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />');
newApp = newApp.replace('<QuizGenerator />', '<QuizGenerator user={user} setCurrentView={setCurrentView} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />');
newApp = newApp.replace('<ArticleRewriter />', '<ArticleRewriter setCurrentView={setCurrentView} isProcessing={isProcessing} setIsProcessing={setIsProcessing} />');

fs.writeFileSync('src/App.tsx', newApp);
console.log('Done!');
