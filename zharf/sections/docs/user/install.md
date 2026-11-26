### Intel Macs

There is no `zharf-code` executable for Intel Macs (the desktop app is available). To
run a server there, build it from source with `vp`, which provides the Node version it needs
([Install vp](../operations/00_development.md#first-checkout)):

```bash
git clone https://github.com/ZharfAI/zharf-code
cd zharf-code && vp i && vp run build:desktop
node apps/server/dist/bin.mjs
```

`zharf-code update` and the background service do not apply to a server run this way;
update it with `git pull` and a rebuild.

## Desktop app

Download Zharf Code for macOS, Windows or Linux from
[platform.zharf.ai/code](https://platform.zharf.ai/code). The same files are attached to each
[GitHub release](https://github.com/ZharfAI/zharf-code/releases). Downloads and updates come
from platform.zharf.ai, so they also work on Iran's national network.

| Platform       | File                                                                 |
| -------------- | -------------------------------------------------------------------- |
| macOS          | `Zharf-Code-<version>-arm64.dmg` (Apple silicon), `-x64.dmg` (Intel) |
| Windows        | `Zharf-Code-<version>-x64.exe`, `-arm64.exe`                         |
| Debian, Ubuntu | `sudo apt install ./Zharf-Code-<version>-amd64.deb` (or `arm64.deb`) |
| Other Linux    | `Zharf-Code-x86_64.AppImage`, `Zharf-Code-arm64.AppImage`            |

Builds that are not code-signed show a warning the first time they open. On macOS, open
**System Settings → Privacy & Security** and choose **Open Anyway**. On Windows, choose
**More info → Run anyway** in the SmartScreen window.

### Linux

AppImage and `.deb` downloads are available for x86_64 and ARM64. Check your
architecture with `uname -m`: for `x86_64`, choose a file ending in
`x86_64.AppImage` or `amd64.deb`; for `aarch64`, choose `arm64.AppImage` or
`arm64.deb`.

To launch an AppImage, open a terminal in its download folder:

```bash
chmod +x ./Zharf-Code-x86_64.AppImage
./Zharf-Code-x86_64.AppImage
```

The `.deb` updates itself like the other desktop builds. It asks for your
password to install each update. If your desktop has no password prompt, the
update fails. Download the new `.deb` and install it the same way.

### Nix (nixpkgs)

<!-- delete -->

## Mobile app

The Zharf Code phone apps are not released yet. Until they are, open the web app from your
phone's browser through [remote access](./remote-access.md).
