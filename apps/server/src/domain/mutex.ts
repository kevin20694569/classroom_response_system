/**
 * 非同步互斥鎖（FIFO）。
 *
 * 業務意義：所有會改變活動狀態的操作（匯入、開啟、結束、送出答案）都經過同一把鎖依序執行。
 * 送出答案的順位就是取得這把鎖的順序，因此並發送出時結果確定且可重現（FR-016、research R9）；
 * 「結束」與「送出」也經過同一把鎖，結束之後處理的送出必定看到「已結束」而被拒絕。
 */
export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.tail.then(fn);
    // 不論成功或失敗都釋放鎖，讓後面的操作繼續
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
