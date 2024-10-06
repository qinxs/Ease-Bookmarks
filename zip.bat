color 0A
title ���Ϊzip

rem ָ��WINRAR·��
@set "path=%path%;D:\Program Files\WinRAR"

rem ���git״̬ clean�˳�ʱ��ֱ��checkout
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

:: -r :��ͬ���ļ���
:: -ibck :��̨����
:: -inul :��ֹ������Ϣ
:: -ep1 :���������ų����ļ���(src)

cls
echo ������ �����ȷ�ϣ�����
echo.

if "%status%" == "" (
  goto checkout
) else (
  goto exit
)

:checkout
echo ���������ԭ��ѹ�����ļ�(js��css)...
echo ���� ֱ�ӹر��˳�
pause>nul
git checkout .
exit

:exit
echo ���ڴ��ǰ����δ�ύ�ļ�
echo ���ֶ���ԭ��ر�ѹ���ļ�...
pause>nul
