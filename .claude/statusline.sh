#!/bin/bash
# 画面の下に、いまのブランチを出す。main のときは、目立たせる(本番につながるため)。
dir=$(cat | sed -n 's/.*"current_dir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -z "$dir" ] && dir=$PWD
b=$(git -C "$dir" branch --show-current 2>/dev/null)
[ -z "$b" ] && exit 0
if [ "$b" = "main" ]; then
  printf '\033[1;41;97m ⚠ main(本番につながる) \033[0m'
else
  printf '\033[1;36m⎇ %s\033[0m' "$b"
fi
