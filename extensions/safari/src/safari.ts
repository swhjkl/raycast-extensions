import { runAppleScript } from "@raycast/utils";
import { safariAppIdentifier } from "./utils";
import { LocalTab } from "./types";

export async function getAllTabs() {
  const output = await runAppleScript(`
    set _outputList to {}
    tell application "${safariAppIdentifier}"
      set _windows to windows
      repeat with w in _windows
        set _win_id to id of w
        set _names to name of tabs of w
        set _urls to URL of tabs of w
        repeat with _tab_index from 1 to count of _names
          set _title to item _tab_index of _names
          set _url to item _tab_index of _urls
          set end of _outputList to (_title & ":::" & _url & ":::" & _win_id & ":::" & _tab_index)
        end repeat
      end repeat
    end tell

    set AppleScript's text item delimiters to "|||"
    set _output to _outputList as string
    set AppleScript's text item delimiters to ""

    return _output
  `);

  if (!output) {
    return [];
  }

  const tabs: LocalTab[] = [];
  for (const entry of output.split("|||")) {
    if (!entry) continue;
    const [title, url, windowId, tabIndex] = entry.split(":::");
    if (title === "Start Page" || title === "iCloud Tabs") continue;
    tabs.push({
      uuid: `${windowId}-${tabIndex}`,
      title,
      url: url || "",
      window_id: parseInt(windowId, 10),
      index: parseInt(tabIndex, 10),
      is_local: true,
    });
  }

  return tabs;
}

export async function addToReadingList(url: string) {
  const escapedUrl = encodeURI(url);
  await runAppleScript(`
    tell application "${safariAppIdentifier}"
      add reading list item "${escapedUrl}"
    end tell
  `);
}

export async function getCurrentTabName() {
  return await runAppleScript(`tell application "${safariAppIdentifier}" to return name of current tab in window 1`);
}

export async function getCurrentTabURL() {
  return await runAppleScript(`tell application "${safariAppIdentifier}" to return URL of current tab in window 1`);
}

export type ContentType = "text" | "source";

export async function getCurrentTabContents(type: ContentType) {
  return await runAppleScript(`tell application "${safariAppIdentifier}" to return ${type} of current tab in window 1`);
}

export async function getTabContents(windowId: number, tabIndex: number, type: ContentType) {
  try {
    return await runAppleScript(`
      tell application "${safariAppIdentifier}"
        if (count of windows) >= ${windowId} then
          set targetWindow to window ${windowId}
          if (count of tabs of targetWindow) >= ${tabIndex} then
            set targetTab to tab ${tabIndex} of targetWindow
            return ${type} of targetTab
          else
            return "Error: Tab index out of range"
          end if
        else
          return "Error: Window ID out of range"
        end if
      end tell
    `);
  } catch (error) {
    return `Error: ${error}`;
  }
}

export async function closeTab(windowId: number, tabIndex: number) {
  try {
    const result = await runAppleScript(`
      tell application "${safariAppIdentifier}"
        if (count of windows) >= ${windowId} then
          set targetWindow to window ${windowId}
          if (count of tabs of targetWindow) >= ${tabIndex} then
            set targetTab to tab ${tabIndex} of targetWindow
            close targetTab
            return "Tab closed successfully"
          else
            return "Error: Tab index out of range"
          end if
        else
          return "Error: Window ID out of range"
        end if
      end tell
    `);
    return result;
  } catch (error) {
    return `Error: ${error}`;
  }
}

export async function closeCurrentTab() {
  try {
    const result = await runAppleScript(`
      tell application "${safariAppIdentifier}"
        close current tab of front window
        return "Current tab closed successfully"
      end tell
    `);
    return result;
  } catch (error) {
    return `Error: ${error}`;
  }
}

export async function getFocusedTab() {
  try {
    const script = `
      tell application "${safariAppIdentifier}"
        set frontWindow to front window
        set currentTab to current tab of frontWindow
        set tabIndex to index of currentTab
        set tabTitle to name of currentTab
        set tabURL to URL of currentTab
        set windowId to id of frontWindow
        
        return windowId & ":::" & tabIndex & ":::" & tabTitle & ":::" & tabURL
      end tell
    `;

    const result = await runAppleScript(script);

    if (result) {
      const [windowId, index, title, url] = result.split(":::");

      return {
        uuid: `${windowId}-${index}`,
        title,
        url: url || "",
        window_id: parseInt(windowId, 10),
        index: parseInt(index, 10),
        is_local: true,
      };
    }

    throw new Error("Could not get focused tab information");
  } catch (error) {
    throw new Error(`Failed to get focused tab: ${error}`);
  }
}

export async function closeOtherTabs() {
  try {
    const script = `
      tell application "${safariAppIdentifier}"
        tell front window
          set currentTabIndex to index of current tab
          close (every tab whose index is not currentTabIndex)
          return "Other tabs closed successfully"
        end tell
      end tell
    `;

    const result = await runAppleScript(script);
    return result;
  } catch (error) {
    return `Error: ${error}`;
  }
}
