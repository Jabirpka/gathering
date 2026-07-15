import { useEffect, useState } from 'react';
import { HelpCircle, Check, X as XIcon, Trophy } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import { quizzesApi } from '../../services/api';
import { Message, QuizState } from '../../types';
import Leaderboard from './Leaderboard';

export default function QuizCard({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [board, setBoard] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    let live = true;
    try {
      const def = JSON.parse(message.content);
      setQuiz({
        messageId: message.id, question: def.question, options: def.options, points: def.points,
        endsAt: def.endsAt ?? null, counts: new Array(def.options.length).fill(0), totalAnswers: 0,
        myAnswer: null, correctIndex: null, ended: false,
      });
    } catch { /* ignore */ }
    quizzesApi.get(message.id).then((r) => { if (live) setQuiz(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [message.id, message.content]);

  useEffect(() => {
    if (!socket) return;
    // Others' answers change the counts; only re-fetch to keep the correct
    // answer hidden until *I've* answered (the socket payload is another viewer's).
    const onUpdate = (d: { messageId: string }) => {
      if (d.messageId === message.id) quizzesApi.get(message.id).then((r) => setQuiz(r.data)).catch(() => {});
    };
    socket.on('quiz:update', onUpdate);
    return () => { socket.off('quiz:update', onUpdate); };
  }, [socket, message.id]);

  if (!quiz) return null;
  const answered = !!quiz.myAnswer;
  const reveal = answered || quiz.ended;

  const answer = (i: number) => {
    if (answered || quiz.ended) return;
    quizzesApi.answer(message.id, i).then((r) => setQuiz(r.data)).catch(() => {});
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-[85%] rounded-2xl border border-amber-300/25 bg-surface-2 p-3.5">
        <div className="flex items-center gap-1.5 mb-2 text-amber-300">
          <HelpCircle size={14} />
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase">Quiz · {quiz.points} pts</span>
          <button onClick={() => setBoard(true)} className="ml-auto flex items-center gap-1 text-[11px] text-brand font-semibold">
            <Trophy size={12} /> Leaderboard
          </button>
        </div>
        <p className="text-sm font-semibold text-white mb-3">{quiz.question}</p>

        <div className="space-y-1.5">
          {quiz.options.map((opt, i) => {
            const isCorrect = reveal && quiz.correctIndex === i;
            const isMyWrong = reveal && quiz.myAnswer?.optionIndex === i && !quiz.myAnswer.correct;
            const count = quiz.counts[i] ?? 0;
            const pct = quiz.totalAnswers > 0 ? Math.round((count / quiz.totalAnswers) * 100) : 0;
            return (
              <button key={i} onClick={() => answer(i)} disabled={answered || quiz.ended}
                className={`relative w-full text-left rounded-xl overflow-hidden border disabled:cursor-default ${
                  isCorrect ? 'border-emerald-400/60' : isMyWrong ? 'border-red-400/60' : 'border-white/10'
                }`}>
                {reveal && (
                  <div className={`absolute inset-y-0 left-0 transition-all duration-300 ${isCorrect ? 'bg-emerald-500/20' : isMyWrong ? 'bg-red-500/15' : 'bg-white/[0.05]'}`}
                    style={{ width: `${pct}%` }} />
                )}
                <div className="relative flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm text-white truncate">{opt}</span>
                  {isCorrect && <Check size={14} className="text-emerald-400 shrink-0" />}
                  {isMyWrong && <XIcon size={14} className="text-red-400 shrink-0" />}
                  {reveal && <span className="text-xs text-slate-300 tabular-nums shrink-0">{count}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400">
          <span>{quiz.totalAnswers} answered</span>
          {answered && (
            <span className={quiz.myAnswer!.correct ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {quiz.myAnswer!.correct ? `Correct · +${quiz.myAnswer!.points}` : 'Wrong'}
            </span>
          )}
          {!answered && !quiz.ended && <span className="text-brand">Tap an answer</span>}
        </div>
      </div>

      {board && message.groupId && <Leaderboard groupId={message.groupId} onClose={() => setBoard(false)} />}
    </div>
  );
}
