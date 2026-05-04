#!/usr/bin/env bash
set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
remote="${AUTOPUSH_REMOTE:-origin}"
branch="${AUTOPUSH_BRANCH:-main}"
interval="${AUTOPUSH_INTERVAL_SECONDS:-15}"
quiet="${AUTOPUSH_QUIET_SECONDS:-20}"
commit_prefix="${AUTOPUSH_COMMIT_PREFIX:-Auto-sync marketing outputs}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*"
}

cd "$repo_dir" || {
  log "Cannot open repo directory: $repo_dir"
  exit 1
}

git_operation_in_progress() {
  local git_dir
  git_dir="$(git rev-parse --git-dir 2>/dev/null)" || return 1
  [ -d "$git_dir/rebase-merge" ] ||
    [ -d "$git_dir/rebase-apply" ] ||
    [ -f "$git_dir/MERGE_HEAD" ] ||
    [ -f "$git_dir/CHERRY_PICK_HEAD" ]
}

working_changes_present() {
  if ! git diff --quiet --ignore-submodules --; then
    return 0
  fi
  if ! git diff --cached --quiet --ignore-submodules --; then
    return 0
  fi
  if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    return 0
  fi
  return 1
}

change_fingerprint() {
  {
    git status --porcelain=v1 --untracked-files=all
    git diff --binary --no-ext-diff
    git diff --cached --binary --no-ext-diff
    git ls-files --others --exclude-standard -z | while IFS= read -r -d '' file; do
      printf 'untracked:%s\n' "$file"
      if [ -f "$file" ]; then
        shasum -a 256 "$file"
      fi
    done
  } | shasum -a 256 | awk '{print $1}'
}

ahead_count() {
  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)" || {
    printf '0'
    return
  }
  git rev-list --count "$upstream..HEAD" 2>/dev/null || printf '0'
}

sync_once() {
  local count commit_message

  if git_operation_in_progress; then
    log "A git operation is already in progress. Resolve it before auto-push can continue."
    return 1
  fi

  if working_changes_present; then
    git add -A
    if git diff --cached --quiet --ignore-submodules --; then
      log "No staged changes after refresh."
    else
      commit_message="$commit_prefix: $(date '+%Y-%m-%d %H:%M:%S %z')"
      if ! git commit -m "$commit_message"; then
        log "Commit failed."
        return 1
      fi
    fi
  fi

  if ! git fetch "$remote" "$branch"; then
    log "Fetch failed for $remote/$branch."
    return 1
  fi

  if ! git rebase "$remote/$branch"; then
    log "Rebase failed. Resolve conflicts, then run git rebase --continue."
    return 1
  fi

  count="$(ahead_count)"
  if [ "${count:-0}" -gt 0 ] 2>/dev/null; then
    if git push "$remote" "HEAD:$branch"; then
      log "Pushed $count commit(s) to $remote/$branch."
    else
      log "Push failed. Check GitHub authentication or network state."
      return 1
    fi
  else
    log "Nothing to push."
  fi
}

if [ "${1:-}" = "--once" ]; then
  sync_once
  exit $?
fi

last_fingerprint=""
last_change_at=0

log "Watching $repo_dir and pushing settled changes to $remote/$branch."

while true; do
  if working_changes_present; then
    now="$(date +%s)"
    fingerprint="$(change_fingerprint)"

    if [ "$fingerprint" != "$last_fingerprint" ]; then
      last_fingerprint="$fingerprint"
      last_change_at="$now"
      log "Change detected. Waiting ${quiet}s for writes to settle."
    elif [ $((now - last_change_at)) -ge "$quiet" ]; then
      log "Changes settled. Starting auto-sync."
      if sync_once; then
        last_fingerprint=""
        last_change_at=0
      fi
    fi
  else
    last_fingerprint=""
    last_change_at=0
    pending="$(ahead_count)"
    if [ "${pending:-0}" -gt 0 ] 2>/dev/null; then
      log "Found $pending unpushed commit(s). Retrying push."
      sync_once
    fi
  fi

  sleep "$interval"
done
