from pathlib import Path

file_path = Path("turnovers.html")
content = file_path.read_text()

old_buttons = '''                        <button
                          class="button button-secondary button-small"
                          type="button"
                          data-action="view-property"
                          data-property-id="${escapeHtml(turnover.property_id)}"
                        >
                          Open Property
                        </button>
                        ${turnover.status !== "cancelled" && turnover.status !== "completed" ? `'''

new_buttons = '''                        <button
                          class="button button-secondary button-small"
                          type="button"
                          data-action="view-property"
                          data-property-id="${escapeHtml(turnover.property_id)}"
                        >
                          Open Property
                        </button>

                        ${["review_required", "correction_required", "completed"].includes(turnover.status) ? `
                          <button
                            class="button button-primary button-small"
                            type="button"
                            data-action="review-turnover"
                            data-turnover-id="${escapeHtml(turnover.id)}"
                          >
                            ${turnover.status === "completed" ? "View Review" : "Review Turnover"}
                          </button>
                        ` : ""}

                        ${turnover.status !== "cancelled" && turnover.status !== "completed" ? `'''

old_listener = '''      turnoversContent.querySelectorAll('[data-action="assign-cleaner"]').forEach(select => {
        select.addEventListener("change", () => {
          assignCleaner(select.dataset.turnoverId, select.value, select);
        });
      });'''

new_listener = '''      turnoversContent.querySelectorAll('[data-action="review-turnover"]').forEach(button => {
        button.addEventListener("click", () => {
          window.location.href =
            `turnover-review.html?id=${encodeURIComponent(button.dataset.turnoverId)}`;
        });
      });

      turnoversContent.querySelectorAll('[data-action="assign-cleaner"]').forEach(select => {
        select.addEventListener("change", () => {
          assignCleaner(select.dataset.turnoverId, select.value, select);
        });
      });'''

if old_buttons not in content:
    raise SystemExit("ERROR: The Actions button section was not found.")

if old_listener not in content:
    raise SystemExit("ERROR: The event-listener section was not found.")

content = content.replace(old_buttons, new_buttons, 1)
content = content.replace(old_listener, new_listener, 1)

file_path.write_text(content)

print("SUCCESS: turnovers.html was updated.")
print("- Review Turnover button added")
print("- Completed turnovers show View Review")
print("- Button opens turnover-review.html with the turnover ID")
