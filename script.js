        class FocusTileApp {
            constructor() {
                this.grid = document.getElementById('grid');
                this.gridSize = 20;
                this.tileWidth = 80;
                this.tileHeight = 40;
                this.heightOffset = 16;
                this.selectedTile = 'grass_center';
                this.currentHeight = 0;
                this.gridData = {};
                
                // Preview system
                this.previewTile = null;
                this.lastPreviewRow = null;
                this.lastPreviewCol = null;
                
                // Timer and productivity system
                this.workTime = 10 * 60; // 10 minutes in seconds
                this.timeRemaining = this.workTime;
                this.timerInterval = null;
                this.isTimerRunning = false;
                this.sessionsCompleted = 0;
                this.tilesEarned = 0;
                this.tilesUsed = 0;
                this.tilesAvailable = 0;
                
                // Notes system
                this.notes = [];
                this.noteIdCounter = 0;
                
                // Tile selector system
                this.availableTileTypes = [
                    // Grass & Terrain
                    'grass_center', 'grass_corner', 'grass_pathBend', 'grass_pathCorner', 'grass_pathCrossing',
                    'grass_pathEnd', 'grass_pathEndSquare', 'grass_pathSlope', 'grass_pathSplit', 'grass_path',
                    'grass_slope', 'grass_slopeConcave', 'grass_slopeConvex', 'grass_waterConcave', 'grass_waterConvex',
                    'grass_waterRiver', 'grass_water',
                    
                    // Rivers & Bridges
                    'grass_riverBend', 'grass_riverBridge', 'grass_riverCorner', 'grass_riverCrossing',
                    'grass_riverEnd', 'grass_riverEndSquare', 'grass_riverSlope', 'grass_riverSplit', 'grass_river',
                    
                    // Buildings
                    'building_center', 'building_sides', 'building_dark_center', 'building_dark_center_door',
                    'building_dark_center_windows', 'building_dark_sides', 'building_dark_sides_door',
                    'building_dark_sides_windows',
                    
                    // Water
                    'water_center', 'water_fall',
                    
                    // Walls
                    'walls_corner', 'walls_end', 'walls_broken', 'walls_left', 'walls_right',
                    'walls_sides', 'walls_square',
                    
                    // Nature
                    'tree', 'trees', 'rocks',
                    
                    // Structures
                    'dome', 'dome_small', 'overhang', 'overhang_small', 'structure_tent', 'structure_tentSlant',
                    
                    // Floor & Terrain
                    'dirt_center', 'dirt_low', 'tiles', 'tiles_crumbled', 'tiles_decorated', 'tiles_steps',
                    
                    // Stairs
                    'stairs_full', 'stairs_left', 'stairs_right'
                ];
                this.currentHotbarTiles = ['grass_center', 'building_center', 'tree', 'water_center', 'walls_corner'];
                
                this.init();
            }
            
            init() {
                this.generateGrid();
                this.setupEventListeners();
                this.loadData(); // Load data first
                this.updateDisplay(); // Then update display
                this.checkTimerState(); // Check if timer was running when user left
            }
            
            generateGrid() {
                this.grid.innerHTML = '';
                
                for (let row = 0; row < this.gridSize; row++) {
                    for (let col = 0; col < this.gridSize; col++) {
                        const tile = document.createElement('div');
                        tile.className = 'tile';
                        tile.dataset.row = row;
                        tile.dataset.col = col;
                        
                        const isoX = (col - row) * (this.tileWidth / 2);
                        const isoY = (col + row) * (this.tileHeight / 2);
                        
                        tile.style.left = isoX + 'px';
                        tile.style.top = isoY + 'px';
                        tile.style.zIndex = (row + col) + 1;
                        
                        tile.addEventListener('click', (e) => this.placeTile(row, col, e));
                        tile.addEventListener('mouseenter', (e) => this.showTilePreview(row, col, e));
                        tile.addEventListener('mouseleave', (e) => this.hideTilePreview());
                        
                        this.grid.appendChild(tile);
                        this.regenerateTilesAtPosition(row, col);
                    }
                }
            }
            
            placeTile(row, col, event) {
                // Don't place tiles if clicking on hotbar or UI elements
                if (event.target.closest('.tile-palette-container') ||
                    event.target.closest('.notes-panel') ||
                    event.target.closest('.notification') ||
                    event.target.closest('.height-controls-card')) {
                    return;
                }
                
                if (this.selectedTile === 'remove') {
                    this.removeTileAtPosition(row, col);
                    return;
                }
                
                event.preventDefault();
                event.stopPropagation();
                
                const height = this.currentHeight;
                const tileKey = `${row}-${col}`;
                
                if (!this.gridData[tileKey]) {
                    this.gridData[tileKey] = {};
                }
                
                // Check if there's already a tile at this position and height
                const isReplacing = this.gridData[tileKey][height] !== undefined;
                
                // If not replacing and no tiles available, show error
                if (!isReplacing && this.tilesAvailable <= 0) {
                    this.showNotification('Complete a 10-minute work session to earn tiles!');
                    return;
                }
                
                this.gridData[tileKey][height] = {
                    type: this.selectedTile,
                    rotation: 'E',
                    row: row,
                    col: col,
                    height: height
                };
                
                // Only consume a tile point if placing a new tile (not replacing)
                if (!isReplacing) {
                    this.tilesAvailable--;
                    this.tilesUsed++;
                }
                
                this.removeTilesAtPosition(row, col);
                this.regenerateTilesAtPosition(row, col);
                this.updateDisplay();
                this.saveData();
                
                // Celebrate animation
                const tileElement = event.target;
                tileElement.classList.add('celebrate');
                setTimeout(() => tileElement.classList.remove('celebrate'), 500);
                
                // Show appropriate notification
                if (isReplacing) {
                    this.showNotification('Tile replaced!');
                } else {
                    this.showNotification('New tile placed!');
                }
            }
            
            regenerateTilesAtPosition(row, col) {
                const tileKey = `${row}-${col}`;
                if (!this.gridData[tileKey]) return;
                
                const heights = Object.keys(this.gridData[tileKey]).map(h => parseInt(h)).sort((a, b) => a - b);
                
                heights.forEach(height => {
                    const tileData = this.gridData[tileKey][height];
                    this.createTileElement(row, col, height, tileData);
                });
            }
            
            createTileElement(row, col, height, tileData) {
                const tileContainer = document.createElement('div');
                tileContainer.className = 'tile';
                tileContainer.dataset.row = row;
                tileContainer.dataset.col = col;
                tileContainer.dataset.height = height;
                
                const isoX = (col - row) * (this.tileWidth / 2);
                const isoY = (col + row) * (this.tileHeight / 2) - (height * this.heightOffset);
                
                tileContainer.style.left = isoX + 'px';
                tileContainer.style.top = isoY + 'px';
                tileContainer.style.zIndex = (row + col) + height + 2;
                
                const img = document.createElement('img');
                img.src = `tiles/${tileData.type}_${tileData.rotation}.png`;
                img.alt = tileData.type;
                
                if (height > 0) {
                    const heightIndicator = document.createElement('div');
                    heightIndicator.className = 'height-indicator';
                    heightIndicator.textContent = height;
                    tileContainer.appendChild(heightIndicator);
                }
                
                tileContainer.appendChild(img);
                tileContainer.addEventListener('click', (e) => this.placeTile(row, col, e));
                
                img.onerror = () => {
                    img.src = `tiles/${tileData.type}_E.png`;
                };
                
                this.grid.appendChild(tileContainer);
            }
            
            removeTilesAtPosition(row, col) {
                const existingTiles = this.grid.querySelectorAll(`[data-row="${row}"][data-col="${col}"]`);
                existingTiles.forEach(tile => {
                    if (tile.dataset.height !== undefined) {
                        tile.remove();
                    }
                });
            }
            
            removeTileAtPosition(row, col) {
                const tileKey = `${row}-${col}`;
                if (!this.gridData[tileKey]) {
                    this.showNotification('No tile to remove at this position!');
                    return;
                }
                
                // Find the highest tile at this position
                const heights = Object.keys(this.gridData[tileKey]).map(h => parseInt(h)).sort((a, b) => b - a);
                
                if (heights.length === 0) {
                    this.showNotification('No tile to remove at this position!');
                    return;
                }
                
                const topHeight = heights[0];
                delete this.gridData[tileKey][topHeight];
                
                // If no more tiles at this position, remove the entire key
                if (Object.keys(this.gridData[tileKey]).length === 0) {
                    delete this.gridData[tileKey];
                }
                
                // Give back a tile and update stats
                this.tilesAvailable++;
                this.tilesUsed--;
                
                // Refresh the visual representation
                this.removeTilesAtPosition(row, col);
                this.regenerateTilesAtPosition(row, col);
                
                this.updateDisplay();
                this.saveData();
                this.showNotification('Tile removed! +1 tile returned');
            }
            
            showTilePreview(row, col, event) {
                // Don't show preview if hovering over UI elements or in remove mode
                if (event.target.closest('.tile-palette-container') ||
                    event.target.closest('.notes-panel') ||
                    event.target.closest('.notification') ||
                    event.target.closest('.height-controls-card') ||
                    this.selectedTile === 'remove') {
                    return;
                }
                
                // Don't show preview if no tiles available (unless replacing)
                const tileKey = `${row}-${col}`;
                const isReplacing = this.gridData[tileKey] && this.gridData[tileKey][this.currentHeight] !== undefined;
                if (!isReplacing && this.tilesAvailable <= 0) {
                    return;
                }
                
                // Remove existing preview
                this.hideTilePreview();
                
                // Create preview tile
                this.previewTile = document.createElement('div');
                this.previewTile.className = 'tile tile-preview';
                this.previewTile.dataset.row = row;
                this.previewTile.dataset.col = col;
                this.previewTile.dataset.height = this.currentHeight;
                
                const isoX = (col - row) * (this.tileWidth / 2);
                const isoY = (col + row) * (this.tileHeight / 2) - (this.currentHeight * this.heightOffset);
                
                this.previewTile.style.left = isoX + 'px';
                this.previewTile.style.top = isoY + 'px';
                this.previewTile.style.zIndex = (row + col) + this.currentHeight + 50; // Above regular tiles but below UI
                
                const img = document.createElement('img');
                img.src = `tiles/${this.selectedTile}_E.png`;
                img.alt = this.selectedTile;
                
                this.previewTile.appendChild(img);
                this.grid.appendChild(this.previewTile);
                
                this.lastPreviewRow = row;
                this.lastPreviewCol = col;
            }
            
            hideTilePreview() {
                if (this.previewTile) {
                    this.previewTile.remove();
                    this.previewTile = null;
                    this.lastPreviewRow = null;
                    this.lastPreviewCol = null;
                }
            }
            
            setupEventListeners() {
                // Tile selection
                document.querySelectorAll('.tile-option').forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Handle tile selector button
                        if (option.classList.contains('tile-selector-btn')) {
                            this.showTileSelector();
                            return;
                        }
                        
                        document.querySelectorAll('.tile-option').forEach(o => o.classList.remove('selected'));
                        option.classList.add('selected');
                        this.selectedTile = option.dataset.tile;
                        this.hideTilePreview(); // Hide preview when changing tile selection
                    });
                });
                
                // Select first tile by default
                const firstOption = document.querySelector('.tile-option:not(.remove-tile):not(.tile-selector-btn)');
                if (firstOption) {
                    firstOption.classList.add('selected');
                    this.selectedTile = firstOption.dataset.tile;
                }
                
                // Prevent tile palette clicks from propagating to grid
                const tilePalette = document.querySelector('.tile-palette-container');
                if (tilePalette) {
                    tilePalette.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
                
                // Prevent height controls card clicks from propagating to grid
                const heightCard = document.querySelector('.height-controls-card');
                if (heightCard) {
                    heightCard.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
                
                // Tile selector modal events
                document.getElementById('closeModal').addEventListener('click', () => {
                    this.hideTileSelector();
                });
                
                document.getElementById('tileSelectorModal').addEventListener('click', (e) => {
                    if (e.target.id === 'tileSelectorModal') {
                        this.hideTileSelector();
                    }
                });
                
                // Grid dragging
                let isDragging = false;
                let lastPos = { x: 0, y: 0 };
                
                const startDrag = (e) => {
                    // Don't start dragging if clicking on hotbar or other UI elements
                    if (e.target.closest('.tile-palette-container') || 
                        e.target.closest('.notes-panel') ||
                        e.target.closest('.notification') ||
                        e.target.closest('.height-controls-card')) {
                        return;
                    }
                    
                    if (e.target === this.grid || e.target.closest('.tile')) {
                        isDragging = true;
                        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                        lastPos = { x: clientX, y: clientY };
                        this.grid.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                };
                
                const doDrag = (e) => {
                    if (isDragging) {
                        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                        const deltaX = clientX - lastPos.x;
                        const deltaY = clientY - lastPos.y;
                        
                        const currentLeft = parseInt(this.grid.style.left) || 400;
                        const currentTop = parseInt(this.grid.style.top) || 200;
                        
                        this.grid.style.left = (currentLeft + deltaX) + 'px';
                        this.grid.style.top = (currentTop + deltaY) + 'px';
                        
                        lastPos = { x: clientX, y: clientY };
                        e.preventDefault();
                    }
                };
                
                const endDrag = () => {
                    isDragging = false;
                    this.grid.style.cursor = 'default';
                };
                
                this.grid.addEventListener('mousedown', startDrag);
                document.addEventListener('mousemove', doDrag);
                document.addEventListener('mouseup', endDrag);
                
                this.grid.addEventListener('touchstart', startDrag, { passive: false });
                document.addEventListener('touchmove', doDrag, { passive: false });
                document.addEventListener('touchend', endDrag);
                
                // Keyboard shortcuts for height control
                document.addEventListener('keydown', (e) => {
                    // Don't trigger if user is typing in input fields
                    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
                        return;
                    }
                    
                    switch(e.key.toLowerCase()) {
                        case 'q':
                            e.preventDefault();
                            this.increaseHeight();
                            break;
                        case 'a':
                            e.preventDefault();
                            this.decreaseHeight();
                            break;
                        case 'c':
                            if (e.ctrlKey || e.metaKey) {
                                // Allow normal copy behavior
                                return;
                            }
                            e.preventDefault();
                            this.clearCurrentHeight();
                            break;
                    }
                });
            }
            
            startTimer() {
                if (this.isTimerRunning) return;
                
                // Use timestamp-based timing for background accuracy
                this.startTime = Date.now();
                this.isTimerRunning = true;
                
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('pauseBtn').style.display = 'inline-block';
                
                this.timerInterval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                    this.timeRemaining = this.workTime - elapsed;
                    
                    if (this.timeRemaining <= 0) {
                        this.timeRemaining = 0;
                        this.updateTimerDisplay();
                        this.completeSession();
                    } else {
                        this.updateTimerDisplay();
                    }
                }, 1000);
                
                this.saveTimerState();
                this.showNotification('Work session started! Focus for 10 minutes.');
            }
            
            pauseTimer() {
                this.isTimerRunning = false;
                clearInterval(this.timerInterval);
                
                // Calculate how much time was actually used
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                this.timeRemaining = Math.max(0, this.workTime - elapsed);
                
                document.getElementById('startBtn').style.display = 'inline-block';
                document.getElementById('pauseBtn').style.display = 'none';
                document.getElementById('startBtn').textContent = 'Resume';
                
                this.clearTimerState();
                this.showNotification('Timer paused. Click Resume when ready.');
            }
            
            completeSession() {
                this.isTimerRunning = false;
                clearInterval(this.timerInterval);
                
                this.sessionsCompleted++;
                this.tilesEarned += 5;
                this.tilesAvailable += 5;
                this.timeRemaining = this.workTime;
                
                document.getElementById('startBtn').style.display = 'inline-block';
                document.getElementById('pauseBtn').style.display = 'none';
                document.getElementById('startBtn').textContent = 'Start Working';
                
                // Reset title
                document.title = 'FocusTile - Notes & Productivity';
                
                this.clearTimerState();
                this.updateDisplay();
                this.saveData();
                
                // Celebration
                document.querySelector('.timer-display').classList.add('celebrate');
                setTimeout(() => {
                    document.querySelector('.timer-display').classList.remove('celebrate');
                }, 500);
                
                this.showNotification('🎉 Session complete! You earned 5 tiles!');
            }
            
            updateTimerDisplay() {
                const minutes = Math.floor(this.timeRemaining / 60);
                const seconds = this.timeRemaining % 60;
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                document.getElementById('timerDisplay').textContent = timeString;
                
                // Update browser tab title with remaining time
                if (this.isTimerRunning) {
                    document.title = `${timeString} - Notile`;
                } else {
                    document.title = 'FocusTile - Notes & Productivity';
                }
            }
            
            updateDisplay() {
                document.getElementById('sessionsCompleted').textContent = this.sessionsCompleted;
                document.getElementById('tilesEarned').textContent = this.tilesEarned;
                document.getElementById('tilesUsed').textContent = this.tilesUsed;
                document.getElementById('tilesRemaining').textContent = this.tilesAvailable;
                document.getElementById('currentHeightDisplayBottom').textContent = this.currentHeight;
                document.getElementById('mobileHeightDisplay').textContent = this.currentHeight;
                this.updateTimerDisplay();
            }
            
            increaseHeight() {
                if (this.currentHeight < 10) {
                    this.currentHeight++;
                    this.updateDisplay();
                    this.animateHeightChange();
                    this.hideTilePreview(); // Hide preview when height changes
                    this.showNotification(`Height increased to level ${this.currentHeight}`);
                } else {
                    this.showNotification('Maximum height level reached (10)');
                }
            }
            
            decreaseHeight() {
                if (this.currentHeight > 0) {
                    this.currentHeight--;
                    this.updateDisplay();
                    this.animateHeightChange();
                    this.hideTilePreview(); // Hide preview when height changes
                    this.showNotification(`Height decreased to level ${this.currentHeight}`);
                } else {
                    this.showNotification('Minimum height level reached (0)');
                }
            }
            
            animateHeightChange() {
                const heightDisplay = document.getElementById('currentHeightDisplayBottom');
                if (heightDisplay) {
                    heightDisplay.classList.add('height-changed');
                    setTimeout(() => {
                        heightDisplay.classList.remove('height-changed');
                    }, 300);
                }
            }
            
            clearCurrentHeight() {
                const tilesToRemove = [];
                
                // Find all tiles at current height
                for (const tileKey in this.gridData) {
                    if (this.gridData[tileKey][this.currentHeight]) {
                        tilesToRemove.push(tileKey);
                    }
                }
                
                if (tilesToRemove.length === 0) {
                    this.showNotification(`No tiles to clear at height ${this.currentHeight}`);
                    return;
                }
                
                // Remove tiles and return tile points
                let tilesCleared = 0;
                tilesToRemove.forEach(tileKey => {
                    delete this.gridData[tileKey][this.currentHeight];
                    
                    // If no more tiles at this position, remove the entire key
                    if (Object.keys(this.gridData[tileKey]).length === 0) {
                        delete this.gridData[tileKey];
                    }
                    
                    // Return tile point
                    this.tilesAvailable++;
                    this.tilesUsed--;
                    tilesCleared++;
                });
                
                // Refresh visual representation
                tilesToRemove.forEach(tileKey => {
                    const [row, col] = tileKey.split('-').map(Number);
                    this.removeTilesAtPosition(row, col);
                    this.regenerateTilesAtPosition(row, col);
                });
                
                this.updateDisplay();
                this.saveData();
                this.showNotification(`Cleared ${tilesCleared} tiles at height ${this.currentHeight}. +${tilesCleared} tiles returned`);
            }
            
            addNote() {
                const input = document.getElementById('noteInput');
                const text = input.value.trim();
                
                if (text) {
                    const note = {
                        id: this.noteIdCounter++,
                        text: text,
                        timestamp: new Date().toLocaleString()
                    };
                    
                    this.notes.unshift(note);
                    input.value = '';
                    this.renderNotes();
                    this.saveData();
                }
            }
            
            renderNotes() {
                const notesList = document.getElementById('notesList');
                notesList.innerHTML = '';
                
                this.notes.forEach(note => {
                    const noteElement = document.createElement('div');
                    noteElement.className = 'note-item';
                    noteElement.innerHTML = `
                        <div class="note-text">${note.text}</div>
                        <div style="font-size: 12px; color: #888; margin-top: 8px;">${note.timestamp}</div>
                    `;
                    
                    noteElement.addEventListener('click', () => {
                        if (confirm('Delete this note?')) {
                            this.notes = this.notes.filter(n => n.id !== note.id);
                            this.renderNotes();
                            this.saveData();
                        }
                    });
                    
                    notesList.appendChild(noteElement);
                });
            }
            
            saveTimerState() {
                if (this.isTimerRunning) {
                    localStorage.setItem('focustile-timer', JSON.stringify({
                        startTime: this.startTime,
                        workTime: this.workTime,
                        isRunning: true
                    }));
                }
            }
            
            clearTimerState() {
                localStorage.removeItem('focustile-timer');
            }
            
            checkTimerState() {
                const timerState = localStorage.getItem('focustile-timer');
                if (timerState) {
                    const state = JSON.parse(timerState);
                    if (state.isRunning) {
                        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
                        const remaining = state.workTime - elapsed;
                        
                        if (remaining <= 0) {
                            // Session completed while away
                            this.completeSession();
                            this.showNotification('🎉 Session completed while you were away! You earned 5 tiles!');
                        } else {
                            // Resume timer
                            this.startTime = state.startTime;
                            this.workTime = state.workTime;
                            this.timeRemaining = remaining;
                            this.isTimerRunning = true;
                            
                            document.getElementById('startBtn').style.display = 'none';
                            document.getElementById('pauseBtn').style.display = 'inline-block';
                            
                            this.timerInterval = setInterval(() => {
                                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                                this.timeRemaining = this.workTime - elapsed;
                                
                                if (this.timeRemaining <= 0) {
                                    this.timeRemaining = 0;
                                    this.updateTimerDisplay();
                                    this.completeSession();
                                } else {
                                    this.updateTimerDisplay();
                                }
                            }, 1000);
                            
                            this.showNotification('Timer resumed from where you left off!');
                        }
                    }
                }
            }
            
            showNotification(message) {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.classList.add('show');
                
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
            
            saveData() {
                const data = {
                    gridData: this.gridData,
                    notes: this.notes,
                    sessionsCompleted: this.sessionsCompleted,
                    tilesEarned: this.tilesEarned,
                    tilesUsed: this.tilesUsed,
                    tilesAvailable: this.tilesAvailable,
                    noteIdCounter: this.noteIdCounter,
                    currentHotbarTiles: this.currentHotbarTiles,
                    currentHeight: this.currentHeight
                };
                localStorage.setItem('focustile-data', JSON.stringify(data));
            }
            
            loadData() {
                const saved = localStorage.getItem('focustile-data');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.gridData = data.gridData || {};
                    this.notes = data.notes || [];
                    this.sessionsCompleted = data.sessionsCompleted || 0;
                    this.tilesEarned = data.tilesEarned !== undefined ? data.tilesEarned : 0;
                    this.tilesUsed = data.tilesUsed || 0;
                    this.tilesAvailable = data.tilesAvailable !== undefined ? data.tilesAvailable : 0;
                    this.noteIdCounter = data.noteIdCounter || 0;
                    this.currentHotbarTiles = data.currentHotbarTiles || ['grass_center', 'building_center', 'tree', 'water_center', 'walls_corner'];
                    this.currentHeight = data.currentHeight || 0;
                    
                    this.generateGrid();
                    this.renderNotes();
                    this.updateActualHotbar();
                } else {
                    // First time user - give them 5 starter tiles
                    this.tilesEarned = 5;
                    this.tilesAvailable = 5;
                    this.saveData(); // Save the initial state
                    this.updateDisplay(); // Update display to show the tiles
                    this.showNotification('Welcome! You start with 5 tiles. Complete work sessions to earn more!');
                }
            }
            
            showTileSelector() {
                const modal = document.getElementById('tileSelectorModal');
                modal.classList.add('show');
                this.populateAvailableTiles();
                this.updateHotbarPreview();
                this.setupTileSearch();
                this.updateTileCount();
            }
            
            hideTileSelector() {
                const modal = document.getElementById('tileSelectorModal');
                modal.classList.remove('show');
                // Clear search when closing
                const searchInput = document.getElementById('tileSearchInput');
                if (searchInput) {
                    searchInput.value = '';
                }
            }
            
            setupTileSearch() {
                const searchInput = document.getElementById('tileSearchInput');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        this.filterTiles(e.target.value.toLowerCase());
                    });
                }
            }
            
            filterTiles(searchTerm) {
                const categoryHeaders = document.querySelectorAll('.tile-category-header');
                const categories = document.querySelectorAll('.tile-category');
                
                categoryHeaders.forEach((header, index) => {
                    const category = categories[index];
                    const tiles = category.querySelectorAll('.available-tile');
                    let hasVisibleTiles = false;
                    
                    tiles.forEach(tile => {
                        const tileName = tile.dataset.tile.toLowerCase();
                        const tileTitle = tile.title.toLowerCase();
                        
                        if (searchTerm === '' || tileName.includes(searchTerm) || tileTitle.includes(searchTerm)) {
                            tile.style.display = 'block';
                            hasVisibleTiles = true;
                        } else {
                            tile.style.display = 'none';
                        }
                    });
                    
                    // Hide category if no tiles are visible
                    if (hasVisibleTiles) {
                        header.style.display = 'block';
                        category.style.display = 'grid';
                    } else {
                        header.style.display = 'none';
                        category.style.display = 'none';
                    }
                });
            }
            
            updateTileCount() {
                const tileCountElement = document.getElementById('tileCount');
                if (tileCountElement) {
                    const totalTiles = this.availableTileTypes.length;
                    const selectedTiles = this.currentHotbarTiles.length;
                    tileCountElement.textContent = `${totalTiles} tiles available • ${selectedTiles}/8 in hotbar`;
                }
            }
            
            populateAvailableTiles() {
                const container = document.getElementById('availableTiles');
                container.innerHTML = '';
                
                // Define tile categories for better organization
                const tileCategories = {
                    'Grass & Terrain': [
                        'grass_center', 'grass_corner', 'grass_pathBend', 'grass_pathCorner', 'grass_pathCrossing', 
                        'grass_pathEnd', 'grass_pathEndSquare', 'grass_pathSlope', 'grass_pathSplit', 'grass_path', 
                        'grass_slope', 'grass_slopeConcave', 'grass_slopeConvex'
                    ],
                    'Buildings': [
                        'building_center', 'building_sides', 'building_dark_center', 'building_dark_center_door', 
                        'building_dark_center_windows', 'building_dark_sides', 'building_dark_sides_door', 
                        'building_dark_sides_windows'
                    ],
                    'Water & Rivers': [
                        'water_center', 'water_fall', 'grass_riverBend', 'grass_riverBridge', 'grass_riverCorner', 
                        'grass_riverCrossing', 'grass_riverEnd', 'grass_riverEndSquare', 'grass_riverSlope', 
                        'grass_riverSplit', 'grass_river', 'grass_waterConcave', 'grass_waterConvex', 
                        'grass_waterRiver', 'grass_water'
                    ],
                    'Walls & Fortifications': [
                        'walls_corner', 'walls_end', 'walls_broken', 'walls_left', 'walls_right', 'walls_sides', 'walls_square'
                    ],
                    'Nature': [
                        'tree', 'trees', 'rocks'
                    ],
                    'Structures & Buildings': [
                        'dome', 'dome_small', 'overhang', 'overhang_small', 'structure_tent', 'structure_tentSlant'
                    ],
                    'Floor & Terrain': [
                        'dirt_center', 'dirt_low', 'tiles', 'tiles_crumbled', 'tiles_decorated', 'tiles_steps'
                    ],
                    'Stairs & Elevation': [
                        'stairs_full', 'stairs_left', 'stairs_right'
                    ]
                };
                
                // Create tiles organized by category
                Object.entries(tileCategories).forEach(([categoryName, tiles]) => {
                    // Filter to only include tiles that exist in our availableTileTypes
                    const availableTilesInCategory = tiles.filter(tile => this.availableTileTypes.includes(tile));
                    
                    if (availableTilesInCategory.length > 0) {
                        // Create category header
                        const categoryHeader = document.createElement('div');
                        categoryHeader.className = 'tile-category-header';
                        categoryHeader.textContent = categoryName;
                        container.appendChild(categoryHeader);
                        
                        // Create category container
                        const categoryContainer = document.createElement('div');
                        categoryContainer.className = 'tile-category';
                        
                        availableTilesInCategory.forEach(tileType => {
                            const tileElement = document.createElement('div');
                            tileElement.className = 'available-tile';
                            tileElement.dataset.tile = tileType;
                            tileElement.style.backgroundImage = `url('tiles/${tileType}_E.png')`;
                            tileElement.title = tileType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            
                            // Handle missing tile images
                            const testImg = new Image();
                            testImg.onload = () => {
                                tileElement.style.backgroundImage = `url('tiles/${tileType}_E.png')`;
                            };
                            testImg.onerror = () => {
                                tileElement.style.backgroundImage = `url('tiles/grass_center_E.png')`;
                                tileElement.style.opacity = '0.5';
                                tileElement.title = `${tileElement.title} (Image not found)`;
                            };
                            testImg.src = `tiles/${tileType}_E.png`;
                            
                            if (this.currentHotbarTiles.includes(tileType)) {
                                tileElement.classList.add('in-hotbar');
                            }
                            
                            tileElement.addEventListener('click', () => {
                                this.toggleTileInHotbar(tileType, tileElement);
                            });
                            
                            categoryContainer.appendChild(tileElement);
                        });
                        
                        container.appendChild(categoryContainer);
                    }
                });
            }
            
            toggleTileInHotbar(tileType, element) {
                const index = this.currentHotbarTiles.indexOf(tileType);
                
                if (index > -1) {
                    // Remove from hotbar
                    this.currentHotbarTiles.splice(index, 1);
                    element.classList.remove('in-hotbar');
                } else {
                    // Add to hotbar (max 8 tiles excluding special buttons)
                    if (this.currentHotbarTiles.length < 8) {
                        this.currentHotbarTiles.push(tileType);
                        element.classList.add('in-hotbar');
                    } else {
                        this.showNotification('Hotbar is full! Remove a tile first.');
                        return;
                    }
                }
                
                this.updateHotbarPreview();
                this.updateActualHotbar();
                this.updateTileCount();
                this.saveData();
            }
            
            updateHotbarPreview() {
                const preview = document.getElementById('hotbarPreview');
                preview.innerHTML = '';
                
                // Add regular tile slots
                this.currentHotbarTiles.forEach((tileType, index) => {
                    const slot = document.createElement('div');
                    slot.className = 'hotbar-slot';
                    slot.style.backgroundImage = `url('tiles/${tileType}_E.png')`;
                    
                    const label = document.createElement('div');
                    label.className = 'slot-label';
                    label.textContent = (index + 1).toString();
                    slot.appendChild(label);
                    
                    preview.appendChild(slot);
                });
                
                // Add remove button preview
                const removeSlot = document.createElement('div');
                removeSlot.className = 'hotbar-slot special';
                removeSlot.innerHTML = '<div class="slot-label"><i class="fas fa-trash"></i></div>';
                removeSlot.style.background = 'rgba(255, 100, 100, 0.2)';
                removeSlot.style.borderColor = 'rgba(255, 100, 100, 0.5)';
                preview.appendChild(removeSlot);
                
                // Add selector button preview
                const selectorSlot = document.createElement('div');
                selectorSlot.className = 'hotbar-slot special';
                selectorSlot.innerHTML = '<div class="slot-label"><i class="fas fa-plus"></i></div>';
                preview.appendChild(selectorSlot);
            }
            
            updateActualHotbar() {
                const container = document.querySelector('.tile-palette-container');
                const specialButtons = container.querySelectorAll('.tile-selector-btn, .remove-tile');
                
                // Clear existing regular tiles
                container.querySelectorAll('.tile-option:not(.tile-selector-btn):not(.remove-tile)').forEach(el => el.remove());
                
                // Add tiles in order before the special buttons
                this.currentHotbarTiles.forEach(tileType => {
                    const tileOption = document.createElement('div');
                    tileOption.className = 'tile-option';
                    tileOption.dataset.tile = tileType;
                    tileOption.style.backgroundImage = `url('tiles/${tileType}_E.png')`;
                    tileOption.title = tileType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    tileOption.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        document.querySelectorAll('.tile-option').forEach(o => o.classList.remove('selected'));
                        tileOption.classList.add('selected');
                        this.selectedTile = tileType;
                    });
                    
                    // Insert before the remove button (which is second to last)
                    const removeButton = container.querySelector('.remove-tile');
                    container.insertBefore(tileOption, removeButton);
                });
                
                // Reselect if current selection is no longer available
                if (!this.currentHotbarTiles.includes(this.selectedTile) && this.selectedTile !== 'remove') {
                    const firstTile = container.querySelector('.tile-option:not(.tile-selector-btn):not(.remove-tile)');
                    if (firstTile) {
                        firstTile.classList.add('selected');
                        this.selectedTile = firstTile.dataset.tile;
                    }
                }
            }
        }
        
        // Global functions
        function startTimer() {
            app.startTimer();
        }
        
        function pauseTimer() {
            app.pauseTimer();
        }
        
        function addNote() {
            app.addNote();
        }
        
        // Initialize app
        let app;
        document.addEventListener('DOMContentLoaded', () => {
            app = new FocusTileApp();
            
            // Enter key to add notes
            document.getElementById('noteInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addNote();
                }
            });
        });