import { runAppleScript, showFailureToast } from "@raycast/utils";
import { closeMainWindow, getPreferenceValues, popToRoot, open } from "@raycast/api";
import { SettingsProfileOpenBehaviour, Tab } from "../interfaces";
import { NOT_INSTALLED_MESSAGE } from "../constants";
import { exec } from "child_process";

export async function getOpenTabs(useOriginalFavicon: boolean): Promise<Tab[]> {
  const sep = Tab.TAB_CONTENTS_SEPARATOR
  const openTabs = await runAppleScript(`
    set _outputList to {}
    tell application "Brave Browser"
      set _windows to windows
      repeat with w in _windows
        set _win_id to id of w
        set _titles to title of tabs of w
        set _urls to URL of tabs of w
        repeat with _tab_index from 1 to count of _titles
          set _title to item _tab_index of _titles
          set _url to item _tab_index of _urls
          set _favicon to ""
          set end of _outputList to (_title & "${sep}" & _url & "${sep}" & _favicon & "${sep}" & _win_id & "${sep}" & _tab_index)
        end repeat
      end repeat
    end tell

    set AppleScript's text item delimiters to "\\n"
    set _output to _outputList as string
    set AppleScript's text item delimiters to ""

    return _output
  `);

  return openTabs
    .split("\n")
    .filter((line) => line.length !== 0)
    .map((line) => Tab.parse(line));
}

export async function openAllBookmarksInFolder({
  urls,
  profileCurrent,
  openTabInProfile,
}: {
  urls: string[];
  profileCurrent: string;
  openTabInProfile: Preferences["openTabInProfile"];
}): Promise<void> {
  try {
    const { browserOption } = getPreferenceValues<Preferences>();

    const buildArgs = (profile?: string): string[] => {
      const args: string[] = [];
      if (profile) {
        args.push(`--profile-directory=${profile}`);
      }
      return args;
    };

    let args: string[] = [];
    switch (openTabInProfile) {
      case SettingsProfileOpenBehaviour.Default:
        args = buildArgs();
        break;
      case SettingsProfileOpenBehaviour.ProfileCurrent:
        args = buildArgs(profileCurrent);
        break;
      case SettingsProfileOpenBehaviour.ProfileOriginal:
        // This is not supported when opening multiple urls, so we fallback to the current profile
        args = buildArgs(profileCurrent);
        break;
    }

    const urlsString = urls.map((url) => `"${url}"`).join(" ");
    const argsString = args.map((arg) => `"${arg}"`).join(" ");
    const command = `open -na "${browserOption}" --args ${argsString} ${urlsString}`;

    await new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
        } else {
          closeMainWindow({ clearRootSearch: true });
          resolve(true);
        }
      });
    });
  } catch (e) {
    console.error(e);
    await showFailureToast("Could not open all bookmarks", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function openNewTab({
  url,
  query,
  profileCurrent,
  profileOriginal,
  openTabInProfile,
  newWindow,
  incognito,
}: {
  url?: string;
  query?: string;
  profileCurrent: string;
  profileOriginal?: string;
  openTabInProfile: Preferences["openTabInProfile"];
  newWindow?: boolean;
  incognito?: boolean;
}): Promise<boolean | string> {
  setTimeout(() => {
    popToRoot({ clearSearchBar: true });
  }, 3000);
  const installed = await checkAppInstalled();
  if (installed) {
    closeMainWindow({ clearRootSearch: true });
  }

  const { browserOption } = getPreferenceValues<Preferences>();
  const targetUrl = url ? url : query ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : "";

  // Helper to run shell command
  const runShellCommand = (command: string): Promise<boolean | string> => {
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  };

  // Build command arguments based on options
  const buildArgs = (profile?: string): string[] => {
    const args: string[] = [];
    if (profile) {
      args.push(`--profile-directory=${profile}`);
    }
    if (newWindow) {
      args.push("--new-window");
    }
    if (incognito) {
      args.push("--incognito");
    }
    if (targetUrl) {
      args.push(targetUrl);
    }
    return args;
  };

  let args: string[] = [];

  switch (openTabInProfile) {
    case SettingsProfileOpenBehaviour.Default:
      args = buildArgs();
      break;
    case SettingsProfileOpenBehaviour.ProfileCurrent:
      args = buildArgs(profileCurrent);
      break;
    case SettingsProfileOpenBehaviour.ProfileOriginal:
      args = buildArgs(profileOriginal);
      break;
  }

  const argsString = args.map((arg) => `"${arg}"`).join(" ");
  const command = `open -na "${browserOption}" --args ${argsString}`;

  return runShellCommand(command);
}

export async function closeTab(tabIndex: number): Promise<void> {
  const { browserOption } = getPreferenceValues<Preferences>();
  await runAppleScript(`tell application "${browserOption}}"
    tell window 1
      delete tab ${tabIndex}
    end tell
  end tell`);
}

export async function setActiveTab(tab: Tab): Promise<void> {
  const { browserOption } = getPreferenceValues<Preferences>();
  await open([
    "hammerspoon://activate_browser_tab",
    `?browser=${browserOption}`,
    `&window=${tab.windowsId}`,
    `&tab=${tab.tabIndex}`
  ].join(''));
}

const checkAppInstalled = async (): Promise<boolean> => {
  const { browserOption } = getPreferenceValues<Preferences>();

  const appInstalled = await runAppleScript(`
set isInstalled to false
try
    do shell script "osascript -e 'exists application \\"${browserOption}\\"'"
    set isInstalled to true
end try

return isInstalled`);
  if (appInstalled === "false") {
    throw new Error(NOT_INSTALLED_MESSAGE);
  }
  return true;
};

export async function executeJavascript(code: string): Promise<void> {
  const { browserOption } = getPreferenceValues<Preferences>();

  try {
    const decodedCode = decodeURIComponent(code);

    // We manually escape the characters that break AppleScript strings.
    // This is safer than JSON.stringify because we control the exact output format.
    const escapedCode = decodedCode
      .replace(/\\/g, "\\\\") // Escape backslashes first!
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\r/g, "\\r") // Escape Carriage Return
      .replace(/\n/g, "\\n") // Escape New Line
      .replace(/\t/g, "\\t") // Escape Tab
      .replace(/[\b]/g, "\\b") // Escape Backspace
      .replace(/\f/g, "\\f"); // Escape Form Feed

    const script = `
      tell application "${browserOption}"
        activate
        tell active tab of front window
          execute javascript "${escapedCode}"
        end tell
      end tell
    `;
    await runAppleScript(script);
    await closeMainWindow();
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.includes("Allow JavaScript from Apple Events")) {
      await showFailureToast("Enable 'View > Developer > Allow JavaScript from Apple Events' in Brave.");
    } else {
      await showFailureToast("Could not run bookmarklet", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
