/** trpc-cli exits immediately afterward; await piped output before resolving.
 * Node's callback also avoids Bun.write stalls after commander initializes stdout.
 */
export function writeStdout(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, error => error ? reject(error) : resolve());
  });
}
