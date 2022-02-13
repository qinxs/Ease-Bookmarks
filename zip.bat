color 0A
title 打包为zip

rem 指定WINRAR路径
@set "path=%path%;D:\Program Files\WinRAR"

rem 检查是git状态
for /f "delims=" %%i in ('git status -s') do set "status=%%i"

cd src
:: dependencies
:: npm install clean-css-cli -g
:: npm install terser -g
pushd css
call cleancss -o popup.css popup.css
popd
pushd js
call terser config.js -o config.js
call terser popup.js -o popup.js
popd

cd..
WinRAR a -r -ibck -inul -ep1 ^
src.zip ^
src\*

:: -r :连同子文件夹
:: -ibck :后台运行
:: -inul :禁止错误信息
:: -ep1 :从名称中排除主文件夹(src)

cls
echo 打包完成 请测试确认！！！
echo.

if "%status%" == "" (
  goto checkout
) else (
  goto exit
)

:checkout
echo 按任意键还原被压缩的文件(js、css)...
echo 否则 直接关闭退出
pause>nul
git checkout .
exit

:exit
echo 由于打包前存在未提交文件
echo 请手动还原相关被压缩文件...
pause>nul
