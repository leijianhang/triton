import argparse
import json
import threading
import time
import urllib.request
from pathlib import Path

import websocket


def get_target():
    with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5) as response:
        targets = json.load(response)
    pages = [
        target
        for target in targets
        if target.get("type") == "page"
        and target.get("url", "").startswith("https://charts.trendspider.com/")
    ]
    if not pages:
        raise RuntimeError("No TrendSpider chart tab found")
    return max(pages, key=lambda target: len(target.get("title", "")))


class CdpClient:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=1)
        self.next_id = 0
        self.pending = {}
        self.events = []
        self.running = True
        self.thread = threading.Thread(target=self._receive, daemon=True)
        self.thread.start()

    def _receive(self):
        while self.running:
            try:
                message = json.loads(self.ws.recv())
            except (TimeoutError, websocket.WebSocketTimeoutException):
                continue
            except Exception:
                return
            if "id" in message:
                waiter = self.pending.get(message["id"])
                if waiter:
                    waiter["result"] = message
                    waiter["event"].set()
            elif "method" in message:
                self.events.append(message)

    def call(self, method, params=None, timeout=10):
        self.next_id += 1
        message_id = self.next_id
        waiter = {"event": threading.Event()}
        self.pending[message_id] = waiter
        self.ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        if not waiter["event"].wait(timeout):
            raise TimeoutError(method)
        self.pending.pop(message_id, None)
        return waiter["result"]

    def evaluate(self, expression):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        return result.get("result", {}).get("result", {}).get("value")

    def close(self):
        self.running = False
        self.ws.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=float, default=12)
    parser.add_argument("--output", default="output/trendspider-network.json")
    parser.add_argument("--click-apply", action="store_true")
    parser.add_argument("--click-label")
    args = parser.parse_args()

    target = get_target()
    client = CdpClient(target["webSocketDebuggerUrl"])
    client.call("Network.enable", {"maxPostDataSize": 1048576})
    client.call("Runtime.enable")

    visible_text = client.evaluate("document.body.innerText")
    start_index = len(client.events)

    click_result = None
    click_label = "APPLY" if args.click_apply else args.click_label
    if click_label:
        click_result = client.evaluate(
            f"""
            (() => {{
              const elements = [...document.querySelectorAll('button,[role="button"],[role="option"],li')];
              const wanted = {json.dumps(click_label)}.toLowerCase();
              const target = elements.find((element) => element.innerText.trim().toLowerCase() === wanted);
              if (!target) return {{ clicked: false, labels: elements.map((el) => el.innerText.trim()).filter(Boolean) }};
              target.click();
              return {{ clicked: true, label: target.innerText.trim() }};
            }})()
            """
        )

    time.sleep(args.seconds)
    captured = client.events[start_index:]
    client.close()

    output = {
        "target": {"title": target.get("title"), "url": target.get("url")},
        "clickResult": click_result,
        "visibleText": visible_text,
        "events": captured,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    methods = {}
    urls = []
    for event in captured:
        methods[event["method"]] = methods.get(event["method"], 0) + 1
        params = event.get("params", {})
        request = params.get("request", {})
        response = params.get("response", {})
        url = request.get("url") or response.get("url")
        if url:
            urls.append(url)
    summary_path = output_path.with_name(f"{output_path.stem}-summary.json")
    summary_path.write_text(
        json.dumps(
            {"clickResult": click_result, "methods": methods, "urls": sorted(set(urls))},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {output_path} and {summary_path}")


if __name__ == "__main__":
    main()
