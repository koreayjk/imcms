import SwiftUI
import WebKit

// 편집국 첫 주소와 앱 안에서 여는 주소들
//   그 밖의 주소(다른 언론사 기사, 매체 홈페이지 밖 링크, 메일·전화)는 사파리 등 바깥 앱으로 연다
let startURL = URL(string: "https://app.imnewsroom.com/newsroom")!
let inAppHosts = ["app.imnewsroom.com", "imnewsroom.com", "www.imnewsroom.com"]

// User-Agent 끝에 붙이는 앱 표시. 웹(lib/ios-app.ts)이 이 글자를 보고 구글 로그인·결제 단추를 숨긴다
let appUserAgent = "Mobile/15E148 IMNewsroomApp/1.0"

struct ContentView: View {
    var body: some View {
        NewsroomWebView()
            .ignoresSafeArea(edges: .bottom)
    }
}

struct NewsroomWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = appUserAgent
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default() // 로그인 유지

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true // 오른쪽으로 밀면 뒤로
        web.scrollView.contentInsetAdjustmentBehavior = .automatic

        // 아래로 당겨 새로고침
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh

        context.coordinator.webView = web
        web.load(URLRequest(url: startURL))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        weak var webView: WKWebView?

        @objc func reload(_ sender: UIRefreshControl) {
            if webView?.url == nil { webView?.load(URLRequest(url: startURL)) } else { webView?.reload() }
            sender.endRefreshing()
        }

        private func isInApp(_ url: URL) -> Bool {
            guard let host = url.host?.lowercased() else { return false }
            return inAppHosts.contains(host) || host.hasSuffix(".supabase.co")
        }

        // 편집국 밖 주소·메일·전화는 바깥 앱으로
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "about" || scheme == "blob" || scheme == "data" { return decisionHandler(.allow) }
            if (scheme == "http" || scheme == "https") && (isInApp(url) || action.targetFrame?.isMainFrame == false) {
                return decisionHandler(.allow)
            }
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }

        // 새 창(target=_blank)으로 여는 링크: 편집국 주소면 같은 화면에서, 아니면 바깥 앱으로
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                if isInApp(url) { webView.load(action.request) } else { UIApplication.shared.open(url) }
            }
            return nil
        }

        // 인터넷이 끊겼을 때 안내 화면
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let code = (error as NSError).code
            if code == NSURLErrorCancelled { return }
            let html = """
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 24px;color:#1D3461">
            <h2>인터넷에 연결되어 있지 않습니다</h2>
            <p style="color:#5B616B">연결을 확인한 뒤 화면을 아래로 당겨 새로고침해 주세요.</p>
            <p><a href="\(startURL.absoluteString)" style="display:inline-block;margin-top:16px;padding:12px 24px;border-radius:999px;background:#1D3461;color:#fff;text-decoration:none">다시 시도</a></p>
            </body></html>
            """
            webView.loadHTMLString(html, baseURL: startURL)
        }

        // 웹의 alert·confirm·prompt (기사 삭제 확인 등)를 아이폰 알림창으로
        private func present(_ alert: UIAlertController) {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            var top = scenes.first?.keyWindow?.rootViewController
            while let next = top?.presentedViewController { top = next }
            top?.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
            present(a)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
            a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
            present(a)
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(nil) })
            a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
            present(a)
        }
    }
}
