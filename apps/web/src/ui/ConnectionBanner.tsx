import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { RECONNECTED_NOTICE_MS } from './timing';

/**
 * 連線狀態橫幅（007 FR-021、contracts/ui-visual.md §5）：固定在畫面頂端、外層不攔截點擊。
 * 只在「曾經連上之後」才有反應：斷線時顯示 disconnectedText（沒有傳就不顯示，例如學生已加入組別時
 * 中斷文字由頂端列顯示）；恢復連線時顯示「已重新連線」RECONNECTED_NOTICE_MS 後消失。
 */
export function ConnectionBanner({
  connected,
  disconnectedText,
}: {
  connected: boolean;
  disconnectedText?: string;
}) {
  const everConnected = useRef(false);
  const wasDisconnected = useRef(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (!connected) {
      if (everConnected.current) wasDisconnected.current = true;
      setReconnected(false);
      return undefined;
    }
    everConnected.current = true;
    if (!wasDisconnected.current) return undefined;
    wasDisconnected.current = false;
    setReconnected(true);
    const timer = setTimeout(() => {
      setReconnected(false);
    }, RECONNECTED_NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [connected]);

  const showDisconnected = !connected && everConnected.current && disconnectedText !== undefined;
  if (!showDisconnected && !reconnected) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
      <p
        role="status"
        className={`ui-anim flex animate-pop-in items-center gap-2 rounded-full px-5 py-2 font-bold text-white shadow-card ${
          showDisconnected ? 'bg-red-700' : 'bg-green-700'
        }`}
      >
        <Icon name={showDisconnected ? 'disconnected' : 'reconnected'} size={18} />
        {showDisconnected ? disconnectedText : '已重新連線'}
      </p>
    </div>
  );
}
