import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { BiCheck, BiCopy } from "react-icons/bi";

interface Code {
  props: { className: string; children: string };
  type: string;
}
type Props = {
  children?: Code | React.ReactNode;
};
// 型ガード関数
function isCodeBlock(children: any): children is Code {
  return children.type === "code";
}
const CodeBlock: React.FC<Props> = ({ children }: Props) => {
  // コピーボタンの処理
  const [isButtonActive, setIsButtonActive] = useState(false);
  const normalStyle = {
    opacity: 0,
    transition: "0.1s",
  };
  const activeStyle = {
    opacity: 1,
    transition: "0.1s",
  };
  const copyBtnStyle = isButtonActive ? activeStyle : normalStyle;

  // コピー完了メッセージの処理
  const [isCopied, setCopied] = useState(false);
  const handleClick = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };
  const copiedStyle = isCopied ? activeStyle : normalStyle;

  // コードブロックでない場合は終了
  if (!children || !isCodeBlock(children)) {
    return null;
  }

  // コードブロックの各要素を設定
  const match = /language-(\w+)(:?.*)/.exec(children.props.className || "");
  const language = match && match[1] ? match[1] : "";
  const fileName = match && match[2] ? match[2].slice(1) : "";
  const code = String(children.props.children).replace(/\n$/, "");
  const syntaxHighlighterClass = fileName
    ? "code-block-with-title"
    : "code-block";
  return (
    <>
      <div>
        {fileName && <div className="code-block-title">{fileName}</div>}
        <div
          className="code-block-wrapper"
          onMouseEnter={() => setIsButtonActive(true)}
          onMouseLeave={() => setIsButtonActive(false)}
        >
          <div className="copied-tooltip" style={copiedStyle}>
            Copied!!
          </div>
          <div className="copy-button" style={copyBtnStyle}>
            <CopyToClipboard text={code} onCopy={() => handleClick()}>
              {isCopied ? (
                <BiCheck color="grey" size={20} />
              ) : (
                <BiCopy color="grey" size={20} />
              )}
            </CopyToClipboard>
          </div>
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            className={syntaxHighlighterClass}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
      <style jsx>{`
        .code-block-wrapper {
          font-size: 0.9rem;
          margin-bottom: 2rem;
          position: relative;
        }
        .code-block-title {
          display: inline-block;
          border-radius: 0.3rem 0.3rem 0 0;
          background-color: #323e52;
          padding: 0.55rem 1rem;
          color: white;
          font-size: 0.8rem;
          font-family: Inconsolata, Monaco, Consolas, "Courier New", Courier,
            monospace;
        }
        .copy-button {
          display: inline-block;
          position: absolute;
          top: 0.8rem;
          right: 0.8rem;
          background-color: rgba(50, 50, 50, 0.1);
          border: 1px solid grey;
          border-radius: 0.3rem;
          padding: 0.2rem;
        }
        .copy-button:hover {
          background-color: rgba(50, 50, 50, 0.9);
          cursor: pointer;
        }
        .copied-tooltip {
          position: absolute;
          top: 0.8rem;
          right: 3.2rem;
          color: white;
          background-color: rgba(50, 50, 50, 0.5);
          border-radius: 0.2rem;
          padding: 0.3rem;
        }
      `}</style>
      <style jsx global>{`
        .code-block {
          border-radius: 0.3rem !important;
          padding: 1.5rem !important;
        }
        .code-block-with-title {
          border-radius: 0 0.3rem 0.3rem 0.3rem !important;
          padding: 1.5rem !important;
          margin-top: 0 !important;
        }
      `}</style>
    </>
  );
};

export default CodeBlock;