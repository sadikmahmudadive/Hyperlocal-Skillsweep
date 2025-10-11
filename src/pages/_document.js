import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    const noFlashScript = `
      (function(){
        try{
          var t = localStorage.getItem('theme') || 'system';
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var dark = t === 'dark' || (t === 'system' && prefersDark);
          var root = document.documentElement;
          if(dark){ root.classList.add('dark'); } else { root.classList.remove('dark'); }
        }catch(e){}
      })();
    `;
    return (
      <Html lang="en">
        <Head>
          <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
