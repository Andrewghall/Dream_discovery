interface ScoreIndicatorProps {
  score: number;
  label: string;
  maxScore?: number;
}

export function ScoreIndicator({ score, label, maxScore = 10 }: ScoreIndicatorProps) {
  const percentage = (score / maxScore) * 100;

  const getColor = () => {
    if (percentage >= 80) return 'text-green-600 border-green-600';
    if (percentage >= 60) return 'text-blue-600 border-blue-600';
    if (percentage >= 40) return 'text-orange-600 border-orange-600';
    return 'text-red-600 border-red-600';
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`
        relative flex items-center justify-center
        w-16 h-16 rounded-full border-4
        ${getColor()}
      `}>
        <span className="text-2xl font-bold">{score}</span>
      </div>
      <p className="text-xs text-gray-600 mt-2 text-center font-medium">{label}</p>
    </div>
  );
}
