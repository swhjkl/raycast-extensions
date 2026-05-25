import { Action, closeMainWindow, Icon, open } from "@raycast/api";
import { LocalTab, Tab } from "../types";
import { safariAppIdentifier } from "../utils";

async function activateLocalTab(tab: LocalTab) {
  await open(
    [
      "hammerspoon://activate_browser_tab",
      `?browser=${safariAppIdentifier}`,
      `&window=${tab.window_id}`,
      `&tab=${tab.index}`,
    ].join(""),
  );
}

export default function OpenTabAction(props: { tab: Tab }) {
  const { tab } = props;

  return tab.is_local ? (
    <Action
      title="Open in Browser"
      icon={Icon.Globe}
      onAction={async () => {
        await activateLocalTab(tab as LocalTab);
        await closeMainWindow({ clearRootSearch: true });
      }}
    />
  ) : (
    <Action.OpenInBrowser url={tab.url} />
  );
}
