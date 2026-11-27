# Security

Report a vulnerability in Zharf Code to **security@zharf.ai**. Please do not open a public issue
for it. Include the version (Settings → About), the platform, and the steps that reproduce it.

Zharf Code runs coding agents with access to your files and your Zharf API key. The Zharf key is
kept in the app's secret store on the machine that runs the server, readable only by your user,
and is sent only to platform.zharf.ai.

A problem that also affects upstream T3 Code should also go to T3 Tools through
[their security policy](https://github.com/pingdotgg/t3code/blob/main/SECURITY.md).
