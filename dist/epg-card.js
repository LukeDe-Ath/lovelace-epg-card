const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class EPGCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _epgData: { type: Object },
    };
  }

  constructor() {
    super();
    this._epgData = {};
    this._lastStateFingerprint = "";
  }

  setConfig(config) {
    if (
      !config.entities ||
      !Array.isArray(config.entities) ||
      config.entities.length === 0
    ) {
      throw new Error("You need to define at least one entity.");
    }
    this.config = {
      row_height: 100,
      ...config,
    };
  }

  getCardSize() {
    return 5;
  }

  shouldUpdate(changedProps) {
    if (!this.hass || !this.config) return false;

    const entityIds = this.config.entities;
    const stateFingerprint = JSON.stringify(
      entityIds.map((id) => {
        const state = this.hass.states[id];
        return state?.state + JSON.stringify(state?.attributes?.today || {});
      })
    );

    if (stateFingerprint !== this._lastStateFingerprint) {
      this._lastStateFingerprint = stateFingerprint;
      this._epgData = this._buildEPGData();
      return true;
    }

    return changedProps.has("config");
  }

  _buildEPGData() {
    const epgData = {};
    const entityIds = this.config.entities;

    entityIds.forEach((entityId) => {
      const state = this.hass.states[entityId];
      if (!state || !state.attributes.today) return;

      const friendlyName = state.attributes.friendly_name || entityId;
      const programs = state.attributes.today;

      epgData[friendlyName] = Object.keys(programs).map((start_time) => {
        const program = programs[start_time];
        const end_time = this._calculateEndTime(
          start_time,
          Object.keys(programs)
        );
        return {
          title: program.title,
          desc: program.desc,
          start: start_time,
          end: end_time,
        };
      });
    });

    return epgData;
  }

  _generateTimeline() {
    const now = new Date();
    const startHour = now.getHours();
    const timeline = [];

    for (let i = 0; i <= 24 - startHour; i++) {
      const hour = (startHour + i) % 24;
      timeline.push(`${hour.toString().padStart(2, "0")}:00`);
      timeline.push(`${hour.toString().padStart(2, "0")}:30`);
    }

    return timeline;
  }

  _convertTimeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  _calculateGridColumn(timeStr) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this._convertTimeToMinutes(timeStr);
    return Math.floor((startMinutes - currentMinutes) / 30) + 1; // grid is 1-indexed
  }

  _calculateEndTime(current, keys) {
    const times = keys.sort();
    const index = times.indexOf(current);
    return index === -1 || index === times.length - 1
      ? "24:00"
      : times[index + 1];
  }

  static get styles() {
    return css`
      .epg-card {
        font-family: Arial, sans-serif;
        width: 100%;
        overflow-x: auto;
        --row-height: 100px;
      }
      .timeline {
        display: grid;
        margin-left: 10%;
        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
        border-bottom: 1px solid #ccc;
        text-align: center;
        font-weight: bold;
        padding: 5px 0;
      }
      .channel-row {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
        height: var(--row-height);
      }
      .channel-name {
        width: 10%;
        text-align: right;
        font-weight: bold;
        padding-right: 10px;
      }
      .programs {
        display: grid;
        width: 90%;
        height: var(--row-height);
        grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
        position: relative;
      }
      .program {
        background-color: gray;
        color: white;
        border-radius: 4px;
        padding: 5px;
        font-size: 14px;
        overflow: hidden;
        white-space: normal;
        word-break: break-word;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .program:hover {
        background-color: #0056b3;
      }
      .program-tooltip {
        display: none;
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        z-index: 1000;
        max-width: 300px;
        line-height: 1.5;
      }
      .program:hover .program-tooltip {
        display: block;
      }
    `;
  }

  render() {
    if (!this._epgData || Object.keys(this._epgData).length === 0) {
      return html`<div class="epg-card">
        <b>Error:</b> No valid EPG data found.
      </div>`;
    }

    const timeline = this._generateTimeline();
    const totalColumns = timeline.length;
    const rowHeight = this.config.row_height;

    return html`
      <div class="epg-card" style="--row-height: ${rowHeight}px;">
        <div
          class="timeline"
          style="grid-template-columns: repeat(${totalColumns}, 1fr);"
        >
          ${timeline.map((t) => html`<div>${t}</div>`)}
        </div>

        ${Object.entries(this._epgData).map(
          ([channel, programs]) => html`
            <div class="channel-row">
              <div class="channel-name">${channel}</div>
              <div
                class="programs"
                style="grid-template-columns: repeat(${totalColumns}, 1fr);"
              >
                ${programs.map((p) => {
                  const start = this._calculateGridColumn(p.start);
                  const end = this._calculateGridColumn(p.end);
                  return html`
                    <div
                      class="program"
                      style="grid-column: ${start} / ${end};"
                    >
                      ${p.title}
                      <span class="program-tooltip">
                        <div>${p.title}</div>
                        <div>${p.desc}</div>
                        <div>${p.start} - ${p.end}</div>
                      </span>
                    </div>
                  `;
                })}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}

customElements.define("epg-card", EPGCard);
