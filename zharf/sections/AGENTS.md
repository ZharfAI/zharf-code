## What makes Zharf Code special?

Zharf Code is ZharfAI's fork of an open-source app that many people use and love (see README.md). It's important we keep
the things they love as we keep changing it. Here's a brief list of the things we can never
compromise on.

### 4. Multi-surface

Zharf Code has 3 key app surfaces: **web**, **desktop**, and **mobile**.

**Web** is kind of two surfaces: the hosted web app ("code.zharf.ai", not live yet) and the web
app the `zharf-code` command serves locally. Both need to be supported by all new features where
reasonable.

**Desktop** is the main surface most users install first. It's a full Electron app that bundles
the server runner as well. The desktop app can also be the host server that other devices
connect to.

**Mobile** is a React Native app for iOS and Android that connects to any Zharf Code server to
control work remotely. Zharf Code's phone apps are not in the stores yet; keep the mobile code
working all the same.
