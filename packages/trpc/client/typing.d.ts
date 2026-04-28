type Vscode = () => {
  getState(): { [key: string]: unknown };
  setState(data: { [key: string]: unknown }): void;
  postMessage: (msg: unknown) => void;
};

declare const acquireVsCodeApi: Vscode;
interface Window {
  vscode?: ReturnType<Vscode>;
}
