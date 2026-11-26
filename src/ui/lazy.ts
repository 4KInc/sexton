// Loading a view's code on first open (the ledger, the method page). Pure: no DOM, so the failure path can be tested.
import { viewLoadErrorHtml } from './messages.ts';
/** The message shown in place of a view whose code did not load: a sentence and a link that reloads the page. */
export const loadFailedHtml = viewLoadErrorHtml;
/**
 * Runs `load`, then hands the mount function's result to `done`. If the code does not load, `fail` gets the message.
 * Nothing happens when `isCurrent` says the reader has already gone to another page.
 */
export async function runLazy(
  load: () => Promise<() => () => void>,
  isCurrent: () => boolean,
  done: (stop: () => void) => void,
  fail: (html: string) => void,
  hash: string,
): Promise<void> {
  let mount: () => () => void;
  try {
    mount = await load();
  } catch {
    if (isCurrent()) fail(loadFailedHtml(hash));
    return;
  }
  if (isCurrent()) done(mount());
}
