import { logger } from '@one-for-all/utils';
import {
  filter,
  find,
  from,
  interval,
  map,
  Observable,
  Subject,
  Subscription,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';

interface Frame<T = any> {
  type: string;
  message: T;
  seq: number;
  echoSeq?: number;
  name: string;
}

type Responder = (data: any) => Promise<any>;

export default class Messenger {
  target: Window;
  receive$: Subject<Frame>;
  send$: Subject<Frame>;
  seq = 0;
  connected = false;

  responderMap: Record<string, Subscription> = {};
  name: string;
  isSubWin: boolean;

  constructor(target: Window, name: string) {
    this.target = target;
    this.name = name;

    this.send$ = new Subject<Frame>();
    this.receive$ = new Subject<Frame>();

    if (window === target) {
      throw new Error('Messenger: target can not be same as current window');
    }

    this.isSubWin = window.parent === target;

    window.addEventListener('message', (e) => {
      if (e.origin !== window.origin) {
        return;
      }

      if (this.name === e.data.name) {
        return;
      }
      const t1 = performance.now();
      this.receive$.next(e.data);
      const delta = performance.now() - t1;
      if (delta > 10) {
        logger.log(this.name, 'execute on message cost:', delta, 'message type:', e.data.type);
      }
    });

    this.send$.subscribe((frame) => {
      this.target.postMessage(frame, window.origin);
    });
  }

  addResponders(responders: Record<string, Responder>): void {
    Object.entries(responders).forEach(([type, responder]) => {
      const subscription = this.receive$
        .pipe(
          filter((frame) => {
            if (frame.type) {
              return frame.type === type;
            }

            return false;
          }),
          switchMap(({ message, seq }) => from(Promise.all([responder(message), Promise.resolve(seq)]))),
          map(([response, echoSeq]) => ({
            type: `echo_${type}`,
            message: response,
            echoSeq,
            seq: this.nextSeq(),
            name: this.name,
          })),
        )
        .subscribe(this.send$);

      if (this.responderMap[type]) {
        this.responderMap[type].unsubscribe();
      }

      this.responderMap[type] = subscription;
    });
  }

  waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      let subscription: Subscription | undefined;

      const timer = setTimeout(() => {
        subscription?.unsubscribe();
        reject(new Error(`${this.name} messenger connection timeout`));
      }, 5 * 1000);

      if (this.isSubWin) {
        subscription = interval(200)
          .pipe(
            tap(() => this.send('ping', 'ping')),
            takeUntil(this.listen('ping')),
          )
          .subscribe({
            complete: () => {
              subscription?.unsubscribe();
              clearTimeout(timer);
              this.connected = true;
              resolve();
            },
          });
      } else {
        this.listen('ping')
          .pipe(take(1))
          .subscribe(() => {
            this.send('ping', 'ping');
            clearTimeout(timer);
            this.connected = true;
            resolve();
          });
      }
    });
  }

  nextSeq(): number {
    this.seq = this.seq + 1;

    return this.seq;
  }

  send(type: string, message: any): void {
    this.send$.next({
      type,
      message,
      seq: this.nextSeq(),
      name: this.name,
    });
  }

  listen<T>(type: string): Observable<T> {
    return this.receive$.pipe(
      filter((frame) => {
        if (frame.type) {
          return frame.type === type;
        }
        return false;
      }),
      map(({ message }) => message as T),
    );
  }

  request<RequestMessage, ResponseMessage>(type: string, message: RequestMessage): Promise<ResponseMessage> {
    const seq = this.nextSeq();
    const wait = new Promise<ResponseMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`messenger request timeout, request message type is: ${type}`));
      }, 5 * 1000);

      const subscription = this.receive$.pipe(find(({ echoSeq }) => echoSeq === seq)).subscribe((frame) => {
        subscription.unsubscribe();
        clearTimeout(timer);

        if (!frame) {
          reject(new Error('fatal'));
          return;
        }

        resolve(frame.message);
      });
    });

    this.send$.next({ type, message, seq, name: this.name });

    return wait;
  }
}
