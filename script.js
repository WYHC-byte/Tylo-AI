// Control reward prompt display logic
function updateRewardPrompt() {
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const rewardPrompt = document.getElementById('rewardPrompt');
                
    // Pro plan hides prompt, other plans show
    if (userPlan === 'pro') {
        rewardPrompt.classList.add('hidden');
    } else {
        rewardPrompt.classList.remove('hidden');
    }
}

// Trigger check when user info panel is clicked (ensure correct state when popup shows)
document.getElementById('userInfoPanel').addEventListener('click', function() {
    // Assume this method is called in popup display logic
    updateRewardPrompt();
});

// Initial check
updateRewardPrompt();

// Plugin Manager Class
class PluginManager {
    constructor() {
        this.plugins = [];
        this.myPlugins = [];
        this.userCredits = 1000;
        this.isPro = false;
        this.isDeveloper = false;
        this.currentFilter = 'all';
        this.blocklyWorkspace = null;
        this.hasAccessRights = false; // Whether maintenance fee has been paid
        this.init();
    }

    async init() {
        // Check user status
        this.isPro = membershipSystem && membershipSystem.checkMembership();
        this.hasAccessRights = this.isPro || localStorage.getItem('pluginAccessRights') === 'true';
        
        // Get user credits
        if (!this.isPro) {
            await this.fetchUserCredits();
        }
        
        // Bind events
        this.bindEvents();
        
        // Load plugin list
        await this.loadPlugins();
        
        // Load and execute purchased plugins
        await this.loadAndExecuteUserPlugins();
    }

    // Add new method
    async loadAndExecuteUserPlugins() {
        try {
            // Get user's purchased plugins
            const { data: userPlugins } = await marketSupabaseClient
                .from('user_plugins')
                .select(`
                    plugin_id,
                    plugins (
                        id,
                        name,
                        js_code,
                        code_type,
                        is_active
                    )
                `)
                .eq('user_id', currentUserId)
                .eq('is_active', true);
            
            if (userPlugins && userPlugins.length > 0) {
                console.log(`Loading ${userPlugins.length} purchased plugins`);
                
                userPlugins.forEach(up => {
                    if (up.plugins && up.plugins.js_code) {
                        try {
                            // Execute plugin code
                            eval(up.plugins.js_code);
                            console.log(`Plugin "${up.plugins.name}" loaded`);
                        } catch (error) {
                            console.error(`Plugin "${up.plugins.name}" failed to load:`, error);
                        }
                    }
                });
                
                // Show load success notification
                if (window.pluginAPI && window.pluginAPI.showNotification) {
                    window.pluginAPI.showNotification(
                        `Loaded ${userPlugins.length} plugins`,
                        'success'
                    );
                }
            }
        } catch (error) {
            console.error('Error loading user plugins:', error);
        }
    }

    // Add use plugin method
    async usePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;
        
        if (plugin.js_code) {
            try {
                eval(plugin.js_code);
                alert(`Plugin "${plugin.name}" activated!`);
                document.getElementById('pluginDetailModal').classList.add('hidden');
            } catch (error) {
                console.error('Error executing plugin:', error);
                alert('Plugin execution failed: ' + error.message);
            }
        }
    }

    bindEvents() {
        // Plugin market button
        document.getElementById('pluginMarketBtn')?.addEventListener('click', () => {
            if (!this.hasAccessRights && !this.isPro) {
                document.getElementById('maintenanceFeeModal').classList.remove('hidden');
            } else {
                this.openMarket();
            }
        });

        // Close button
        document.getElementById('closePluginMarketBtn')?.addEventListener('click', () => {
            document.getElementById('pluginMarketModal').classList.add('hidden');
        });

        // Category tabs
        document.querySelectorAll('.plugin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.filterPlugins(e.target.dataset.category);
            });
        });

        // Search
        document.getElementById('pluginSearchInput')?.addEventListener('input', (e) => {
            this.searchPlugins(e.target.value);
        });

        // Become developer
        document.getElementById('becomeDevBtn')?.addEventListener('click', () => {
            this.applyForDeveloper();
        });

        // My plugins
        document.getElementById('myPluginsBtn')?.addEventListener('click', () => {
            this.showMyPlugins();
        });

        // Maintenance fee payment
        document.getElementById('payMaintenanceFee')?.addEventListener('click', () => {
            this.payMaintenanceFee();
        });

        document.getElementById('cancelMaintenanceFee')?.addEventListener('click', () => {
            document.getElementById('maintenanceFeeModal').classList.add('hidden');
        });
    }

    async loadPlugins() {
        try {
            const { data, error } = await marketSupabaseClient
                .from('plugins')
                .select('*')
                .eq('status', 'approved')
                .order('is_official', { ascending: false })
                .order('downloads', { ascending: false });

            if (error) throw error;
            
            this.plugins = data || [];
            this.renderPlugins();
        } catch (error) {
            console.error('Error loading plugins:', error);
            alert('Failed to load plugins, please try again later');
        }
    }

    renderPlugins(pluginsToRender = this.plugins) {
        const pluginList = document.getElementById('pluginList');
        
        if (!pluginsToRender.length) {
            pluginList.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <i class="fas fa-box-open text-4xl mb-2"></i>
                    <p>No plugins available</p>
                </div>
            `;
            return;
        }

        pluginList.innerHTML = pluginsToRender.map(plugin => `
            <div class="plugin-card" onclick="pluginManager.showPluginDetail('${plugin.id}')">
                ${plugin.is_official ? '<div class="plugin-official-badge">Official</div>' : ''}
                <div class="text-4xl mb-3">${plugin.icon_url || '🔌'}</div>
                <h3 class="font-bold text-lg mb-2">${plugin.name}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                    ${plugin.description || 'No description'}
                </p>
                <div class="flex justify-between items-center">
                    <div class="${plugin.price === 0 ? 'plugin-price-free' : 'plugin-price'}">
                        ${plugin.price === 0 ? 'Free' : `${plugin.price} Credits`}
                    </div>
                    <div class="plugin-stats">
                        <div class="plugin-stat">
                            <i class="fas fa-download"></i>
                            <span>${plugin.downloads || 0}</span>
                        </div>
                        <div class="plugin-stat">
                            <i class="fas fa-star text-yellow-500"></i>
                            <span>${plugin.rating || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async showPluginDetail(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;

        const modal = document.getElementById('pluginDetailModal');
        const content = document.getElementById('pluginDetailContent');

        // Check if purchased
        const isPurchased = await this.checkIfPurchased(pluginId);

        content.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-2xl font-bold mb-2">${plugin.name}</h2>
                    <p class="text-gray-600 dark:text-gray-400">Author: ${plugin.author_name || 'Unknown'}</p>
                </div>
                <button onclick="document.getElementById('pluginDetailModal').classList.add('hidden')" 
                    class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <div class="mb-6">
                <div class="text-5xl mb-4">${plugin.icon_url || '🔌'}</div>
                <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
                    ${plugin.description || 'No detailed description'}
                </p>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <div class="text-2xl font-bold text-purple-600">${plugin.downloads || 0}</div>
                    <div class="text-sm text-gray-500">Downloads</div>
                </div>
                <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <div class="text-2xl font-bold text-yellow-500">${plugin.rating || 0}</div>
                    <div class="text-sm text-gray-500">Rating</div>
                </div>
                <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <div class="text-2xl font-bold text-green-500">${plugin.version || '1.0.0'}</div>
                    <div class="text-sm text-gray-500">Version</div>
                </div>
            </div>

            <div class="flex gap-3">
                ${isPurchased ? `
                    <button onclick="pluginManager.usePlugin('${pluginId}')" 
                        class="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                        <i class="fas fa-play mr-2"></i>Use Plugin
                    </button>
                ` : `
                    <button onclick="pluginManager.purchasePlugin('${pluginId}')" 
                        class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 font-medium">
                        <i class="fas fa-shopping-cart mr-2"></i>
                        ${plugin.price === 0 ? 'Get Free' : `Purchase (${plugin.price} Credits)`}
                    </button>
                `}
                ${plugin.code_type === 'javascript' || plugin.code_type === 'blocks' ? `
                    <button onclick="pluginManager.viewCode('${pluginId}')" 
                        class="px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                        <i class="fas fa-code mr-2"></i>View Code
                    </button>
                ` : ''}
            </div>
        `;

        modal.classList.remove('hidden');
    }

    async fetchUserCredits() {
        if (this.isPro) {
            this.userCredits = Infinity;
            document.getElementById('marketCredits').textContent = '∞';
            document.getElementById('proUserBadge').classList.remove('hidden');
            return;
        }

        try {
            const { data, error } = await marketSupabaseClient
                .from('user_credits')
                .select('credits')
                .eq('user_id', currentUserId)
                .single();

            if (data) {
                this.userCredits = data.credits;
            } else {
                // Initialize credits
                await marketSupabaseClient
                    .from('user_credits')
                    .insert({ user_id: currentUserId, credits: 1000 });
                this.userCredits = 1000;
            }

            document.getElementById('marketCredits').textContent = this.userCredits;
        } catch (error) {
            console.error('Error fetching credits:', error);
        }
    }

    async purchasePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;

        // Pro users or free plugins direct purchase
        if (this.isPro || plugin.price === 0) {
            await this.completePurchase(pluginId, 0);
            return;
        }

        // Check credits
        if (this.userCredits < plugin.price) {
            alert(`Insufficient credits! You have ${this.userCredits} credits, need ${plugin.price} credits.`);
            return;
        }

        if (confirm(`Confirm purchase "${plugin.name}"?\nWill cost ${plugin.price} credits`)) {
            await this.completePurchase(pluginId, plugin.price);
        }
    }

    async completePurchase(pluginId, price) {
        try {
            // Record purchase
            const { error: purchaseError } = await marketSupabaseClient
                .from('user_plugins')
                .insert({
                    user_id: currentUserId,
                    plugin_id: pluginId,
                    price_paid: price
                });

            if (purchaseError) throw purchaseError;

            // Deduct credits (if not Pro user and not free plugin)
            if (!this.isPro && price > 0) {
                const { error: creditError } = await marketSupabaseClient
                    .from('user_credits')
                    .update({ 
                        credits: this.userCredits - price,
                        total_spent: (await this.getTotalSpent()) + price
                    })
                    .eq('user_id', currentUserId);

                if (creditError) throw creditError;

                this.userCredits -= price;
                document.getElementById('marketCredits').textContent = this.userCredits;
            }

            // Update download count
            await marketSupabaseClient
                .from('plugins')
                .update({ downloads: (await this.getPluginDownloads(pluginId)) + 1 })
                .eq('id', pluginId);

            alert('Purchase successful!');
            document.getElementById('pluginDetailModal').classList.add('hidden');
            
            // Refresh plugin details
            this.showPluginDetail(pluginId);
        } catch (error) {
            console.error('Purchase error:', error);
            alert('Purchase failed, please try again');
        }
    }

    async checkIfPurchased(pluginId) {
        try {
            const { data } = await marketSupabaseClient
                .from('user_plugins')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('plugin_id', pluginId)
                .single();

            return !!data;
        } catch {
            return false;
        }
    }

    async payMaintenanceFee() {
        // Use same payment method as main project
        const orderNo = 'PLUGIN' + Date.now();
        
        // Prepare payment parameters
        const params = {
            pid: '1338',
            type: 'wxpay',
            out_trade_no: orderNo,
            notify_url: window.location.origin + '/payment-callback',
            return_url: window.location.origin + '/chat.html?plugin_payment=success',
            name: 'Plugin Service Maintenance Fee',
            money: '3.0',
            sitename: 'JorkAI'
        };

        // Calculate signature (use main project's signature method)
        const sortedKeys = Object.keys(params).sort();
        let signStr = '';
        sortedKeys.forEach(key => {
            signStr += key + '=' + params[key] + '&';
        });
        signStr = signStr.substring(0, signStr.length - 1);
        signStr += 'PEFevQkzd6B8ZW2FxYay07UcboFmwNFK';
        
        const sign = CryptoJS.MD5(signStr).toString();
        params.sign = sign;
        params.sign_type = 'MD5';

        // Create form and submit
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://code.lfk.cc/submit.php';
        
        Object.keys(params).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    }

    openMarket() {
        document.getElementById('pluginMarketModal').classList.remove('hidden');
        this.loadPlugins();
    }

    filterPlugins(category) {
        this.currentFilter = category;
        
        // Update tab status
        document.querySelectorAll('.plugin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        // Filter plugins
        let filtered = this.plugins;
        if (category === 'official') {
            filtered = this.plugins.filter(p => p.is_official);
        } else if (category !== 'all') {
            filtered = this.plugins.filter(p => p.category === category);
        }

        this.renderPlugins(filtered);
    }

    searchPlugins(query) {
        const filtered = this.plugins.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
        );
        this.renderPlugins(filtered);
    }

    // Blockly programming related methods
    switchEditorTab(tab) {
        const blocklyEditor = document.getElementById('blocklyEditor');
        const jsEditor = document.getElementById('jsEditor');
        const blocklyTab = document.getElementById('blocklyTab');
        const jsTab = document.getElementById('jsTab');

        if (tab === 'blockly') {
            blocklyEditor.classList.remove('hidden');
            jsEditor.classList.add('hidden');
            blocklyTab.classList.add('active');
            jsTab.classList.remove('active');
            
            // Initialize Blockly (if not initialized yet)
            if (!this.blocklyWorkspace) {
                this.initBlockly();
            }
        } else {
            blocklyEditor.classList.add('hidden');
            jsEditor.classList.remove('hidden');
            blocklyTab.classList.remove('active');
            jsTab.classList.add('active');
        }
    }

    initBlockly() {
        // Define custom blocks
        Blockly.defineBlocksWithJsonArray([
            {
                "type": "plugin_onload",
                "message0": "When plugin loads %1",
                "args0": [{
                    "type": "input_statement",
                    "name": "DO"
                }],
                "colour": 230,
                "tooltip": "Execute when plugin loads"
            },
            {
                "type": "plugin_add_style",
                "message0": "Add style Name %1 Prompt %2",
                "args0": [
                    {
                        "type": "field_input",
                        "name": "NAME",
                        "text": "Custom Style"
                    },
                    {
                        "type": "field_input",
                        "name": "PROMPT",
                        "text": "Please reply using... style"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": 160,
                "tooltip": "Add custom style option"
            },
            {
                "type": "plugin_add_model",
                "message0": "Add model Name %1 API Key %2",
                "args0": [
                    {
                        "type": "field_input",
                        "name": "NAME",
                        "text": "Custom Model"
                    },
                    {
                        "type": "field_input",
                        "name": "API_KEY",
                        "text": "model-key"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": 120,
                "tooltip": "Add custom model"
            },
            {
                "type": "plugin_modify_ui",
                "message0": "Modify UI %1 to %2",
                "args0": [
                    {
                        "type": "field_dropdown",
                        "name": "ELEMENT",
                        "options": [
                            ["Theme Color", "theme"],
                            ["Font Size", "fontsize"],
                            ["Layout", "layout"]
                        ]
                    },
                    {
                        "type": "field_input",
                        "name": "VALUE",
                        "text": "value"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": 290,
                "tooltip": "Modify UI elements"
            },
            {
                "type": "plugin_add_button",
                "message0": "Add button Text %1 On click %2",
                "args0": [
                    {
                        "type": "field_input",
                        "name": "TEXT",
                        "text": "Button"
                    },
                    {
                        "type": "input_statement",
                        "name": "ONCLICK"
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": 20,
                "tooltip": "Add custom button"
            }
        ]);

        // Define code generators
        Blockly.JavaScript['plugin_onload'] = function(block) {
            const statements = Blockly.JavaScript.statementToCode(block, 'DO');
            return `
(function() {
    ${statements}
})();`;
        };

        Blockly.JavaScript['plugin_add_style'] = function(block) {
            const name = block.getFieldValue('NAME');
            const prompt = block.getFieldValue('PROMPT');
            return `pluginAPI.addStyle('${name}', '${prompt}');\n`;
        };

        Blockly.JavaScript['plugin_add_model'] = function(block) {
            const name = block.getFieldValue('NAME');
            const apiKey = block.getFieldValue('API_KEY');
            return `pluginAPI.addModel('${name}', '${apiKey}');\n`;
        };

        Blockly.JavaScript['plugin_modify_ui'] = function(block) {
            const element = block.getFieldValue('ELEMENT');
            const value = block.getFieldValue('VALUE');
            return `pluginAPI.modifyUI('${element}', '${value}');\n`;
        };

        Blockly.JavaScript['plugin_add_button'] = function(block) {
            const text = block.getFieldValue('TEXT');
            const onclick = Blockly.JavaScript.statementToCode(block, 'ONCLICK');
            return `pluginAPI.addButton('${text}', function() {\n${onclick}});\n`;
        };

        // Create workspace
        const toolbox = {
            "kind": "categoryToolbox",
            "contents": [
                {
                    "kind": "category",
                    "name": "Plugin Basics",
                    "colour": 230,
                    "contents": [
                        {"kind": "block", "type": "plugin_onload"}
                    ]
                },
                {
                    "kind": "category",
                    "name": "Add Features",
                    "colour": 160,
                    "contents": [
                        {"kind": "block", "type": "plugin_add_style"},
                        {"kind": "block", "type": "plugin_add_model"},
                        {"kind": "block", "type": "plugin_add_button"}
                    ]
                },
                {
                    "kind": "category",
                    "name": "UI Modification",
                    "colour": 290,
                    "contents": [
                        {"kind": "block", "type": "plugin_modify_ui"}
                    ]
                }
            ]
        };

        this.blocklyWorkspace = Blockly.inject('blocklyEditor', {
            toolbox: toolbox,
            grid: {
                spacing: 20,
                length: 3,
                colour: '#ccc',
                snap: true
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 1.0,
                maxScale: 3,
                minScale: 0.3,
                scaleSpeed: 1.2
            },
            trashcan: true
        });
    }

    // Add: Generate code from blocks
    generateCodeFromBlocks() {
        if (!this.blocklyWorkspace) return '';
        return Blockly.JavaScript.workspaceToCode(this.blocklyWorkspace);
    }

    async showMyPlugins() {
        try {
            const { data } = await marketSupabaseClient
                .from('user_plugins')
                .select(`
                    *,
                    plugins (*)
                `)
                .eq('user_id', currentUserId);

            this.myPlugins = data || [];
            
            // Show my plugins list
            this.renderPlugins(this.myPlugins.map(up => up.plugins));
        } catch (error) {
            console.error('Error loading my plugins:', error);
        }
    }

    async applyForDeveloper() {
        // Check if already a developer
        if (this.isDeveloper) {
            this.openDeveloperPanel();
            return;
        }

        // Pro users or users who paid maintenance fee become developers directly
        if (this.isPro || this.hasAccessRights) {
            try {
                // Create developer record directly
                await marketSupabaseClient
                    .from('developer_applications')
                    .insert({
                        user_id: currentUserId,
                        real_name: localStorage.getItem('jiorkUserNickname') || 'Developer',
                        email: currentUser?.email || 'developer@jorkai.cn',
                        description: 'Pro user/Paid maintenance fee, automatically approved',
                        status: 'approved',
                        approved_at: new Date().toISOString()
                    });
                
                this.isDeveloper = true;
                alert('Congratulations on becoming a developer! You can now publish plugins.');
                this.openDeveloperPanel();
            } catch (error) {
                if (error.code === '23505') { // Already exists
                    this.isDeveloper = true;
                    this.openDeveloperPanel();
                } else {
                    console.error('Error becoming developer:', error);
                    alert('Failed to become developer, please try again');
                }
            }
        } else {
            // Unpaid users prompt
            alert('Please upgrade to Pro or pay $3 maintenance fee to become a developer');
            document.getElementById('maintenanceFeeModal').classList.remove('hidden');
        }
    }

    // Add: Open developer panel
    openDeveloperPanel() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 1000px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="developer-panel">
                    <h2 class="text-2xl font-bold mb-4">
                        <i class="fas fa-code mr-2"></i>Developer Center
                    </h2>
                    <div class="developer-stats">
                        <div class="developer-stat-card">
                            <div class="developer-stat-value" id="devPluginCount">0</div>
                            <div class="developer-stat-label">Published Plugins</div>
                        </div>
                        <div class="developer-stat-card">
                            <div class="developer-stat-value" id="devTotalDownloads">0</div>
                            <div class="developer-stat-label">Total Downloads</div>
                        </div>
                        <div class="developer-stat-card">
                            <div class="developer-stat-value" id="devTotalEarnings">0</div>
                            <div class="developer-stat-label">Total Earnings (Credits)</div>
                        </div>
                        <div class="developer-stat-card">
                            <div class="developer-stat-value" id="devAvgRating">0</div>
                            <div class="developer-stat-label">Average Rating</div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold">My Plugins</h3>
                        <button onclick="pluginManager.createNewPlugin()" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                            <i class="fas fa-plus mr-2"></i>Create New Plugin
                        </button>
                    </div>
                    <div id="myPluginsList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Plugin list -->
                    </div>
                </div>
                
                <div class="flex justify-end mt-6">
                    <button onclick="this.closest('.modal-overlay').remove()" class="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Load developer data
        this.loadDeveloperData();
    }

    // Add: Create new plugin
    createNewPlugin() {
        document.getElementById('pluginEditorModal').classList.remove('hidden');
        this.currentEditingPlugin = null;
        document.getElementById('jsCodeEditor').value = '';
        if (this.blocklyWorkspace) {
            this.blocklyWorkspace.clear();
        }
    }

    // Add: Save plugin
    async savePlugin() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 600px;">
                <h3 class="text-xl font-bold mb-4">Publish Plugin</h3>
                <form id="publishPluginForm">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Plugin Name *</label>
                            <input type="text" name="name" required class="w-full px-3 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Version</label>
                            <input type="text" name="version" value="1.0.0" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <label class="block text-sm font-medium mb-2">Plugin Description *</label>
                        <textarea name="description" rows="3" required class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Category</label>
                            <select name="category" class="w-full px-3 py-2 border rounded-lg">
                                <option value="tool">Tool</option>
                                <option value="efficiency">Efficiency</option>
                                <option value="entertainment">Entertainment</option>
                                <option value="learning">Learning</option>
                                <option value="style">Style</option>
                                <option value="model">Model Extension</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Price (Credits)</label>
                            <input type="number" name="price" min="0" value="0" class="w-full px-3 py-2 border rounded-lg">
                            <span class="text-xs text-gray-500">0 means free</span>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <label class="block text-sm font-medium mb-2">Icon (emoji)</label>
                        <input type="text" name="icon" placeholder="🔌" maxlength="2" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    
                    <div class="flex gap-3 mt-6">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                            class="flex-1 py-2 bg-gray-200 rounded-lg">Cancel</button>
                        <button type="submit" class="flex-1 py-2 bg-purple-600 text-white rounded-lg">Publish Plugin</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('publishPluginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            // Get code
            let code = '';
            let codeType = 'javascript';
            
            if (document.getElementById('blocklyTab').classList.contains('active')) {
                code = this.generateCodeFromBlocks();
                codeType = 'blocks';
            } else {
                code = document.getElementById('jsCodeEditor').value;
            }
            
            if (!code.trim()) {
                alert('Please write plugin code first');
                return;
            }
            
            try {
                const { error } = await marketSupabaseClient
                    .from('plugins')
                    .insert({
                        name: formData.get('name'),
                        description: formData.get('description'),
                        author_id: currentUserId,
                        author_name: localStorage.getItem('jiorkUserNickname') || 'Developer',
                        price: parseInt(formData.get('price')) || 0,
                        category: formData.get('category'),
                        icon_url: formData.get('icon') || '🔌',
                        version: formData.get('version'),
                        code_type: codeType,
                        js_code: code,
                        status: 'approved', // Auto-approve
                        is_official: false
                    });
                
                if (error) throw error;
                
                alert('Plugin published successfully!');
                modal.remove();
                document.getElementById('pluginEditorModal').classList.add('hidden');
                this.loadPlugins();
            } catch (error) {
                console.error('Error publishing plugin:', error);
                alert('Failed to publish, please try again');
            }
        });
    }

    // Helper methods
    async getTotalSpent() {
        const { data } = await marketSupabaseClient
            .from('user_credits')
            .select('total_spent')
            .eq('user_id', currentUserId)
            .single();
        return data?.total_spent || 0;
    }

    async getPluginDownloads(pluginId) {
        const { data } = await marketSupabaseClient
            .from('plugins')
            .select('downloads')
            .eq('id', pluginId)
            .single();
        return data?.downloads || 0;
    }
}

// Initialize plugin manager
let pluginManager;

// Plugin API System
window.pluginAPI = {
    // Add custom style
    addStyle: function(name, prompt) {
        const styleSelectors = ['styleSelector', 'replyStyleSelector'];
        
        styleSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                const options = selector.querySelector('.dropdown-options');
                
                // Check if already added
                if (!options.querySelector(`[data-value="${name.toLowerCase().replace(/\s+/g, '-')}"]`)) {
                    const newOption = document.createElement('div');
                    newOption.className = 'dropdown-option';
                    newOption.dataset.value = name.toLowerCase().replace(/\s+/g, '-');
                    newOption.dataset.prompt = prompt;
                    newOption.innerHTML = `<i class="fas fa-comment-dots mr-2"></i>${name}`;
                    
                    options.appendChild(newOption);
                    
                    // Bind click event
                    newOption.addEventListener('click', () => {
                        const allOptions = options.querySelectorAll('.dropdown-option');
                        allOptions.forEach(opt => opt.classList.remove('selected'));
                        newOption.classList.add('selected');
                        options.classList.remove('open');
                    });
                }
            }
        });
        
        console.log(`Style "${name}" added`);
    },
    
    // Add custom model
    addModel: function(modelConfig) {
        const modelSelectors = ['modelSelector', 'replyModelSelector'];
        
        modelSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                const options = selector.querySelector('.dropdown-options');
                
                if (!options.querySelector(`[data-value="${modelConfig.id}"]`)) {
                    const newOption = document.createElement('div');
                    newOption.className = 'dropdown-option';
                    newOption.dataset.value = modelConfig.id;
                    newOption.dataset.apiEndpoint = modelConfig.apiEndpoint;
                    
                    let html = modelConfig.name;
                    if (modelConfig.badge) {
                        html += ` <span class="model-badge ${modelConfig.badgeColor || 'bg-blue-500'} text-white">${modelConfig.badge}</span>`;
                    }
                    newOption.innerHTML = html;
                    
                    options.appendChild(newOption);
                    
                    // Bind click event
                    newOption.addEventListener('click', () => {
                        const allOptions = options.querySelectorAll('.dropdown-option');
                        allOptions.forEach(opt => opt.classList.remove('selected'));
                        newOption.classList.add('selected');
                        
                        // Update globally selected model
                        globalSelectedModel = modelConfig.id;
                        
                        const selected = selector.querySelector('.dropdown-selected span');
                        if (selected) {
                            selected.textContent = modelConfig.name;
                        }
                        
                        options.classList.remove('open');
                        
                        // Sync the other selector
                        if (!isModelSyncing) {
                            isModelSyncing = true;
                            const targetId = selectorId === 'modelSelector' ? 'replyModelSelector' : 'modelSelector';
                            syncModelSelector(targetId, modelConfig.id);
                            isModelSyncing = false;
                        }
                    });
                }
            }
        });
        
        console.log(`Model "${modelConfig.name}" added`);
    },
    
    // Add button
    addButton: function(text, onClick) {
        const promptButtons = document.getElementById('promptButtons');
        if (promptButtons) {
            const button = document.createElement('button');
            button.className = 'flex items-center px-4 py-2 mb-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
            button.innerHTML = `<i class="fas fa-star mr-2"></i>${text}`;
            button.addEventListener('click', onClick);
            promptButtons.appendChild(button);
        }
    },
    
    // Modify UI
    modifyUI: function(element, value) {
        switch(element) {
            case 'theme':
                document.documentElement.className = value;
                break;
            case 'fontsize':
                document.documentElement.style.fontSize = value;
                break;
            case 'layout':
                // Implement layout modification
                break;
        }
    },
    
    // Show notification
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            info: 'bg-blue-100 text-blue-800',
            success: 'bg-green-100 text-green-800',
            warning: 'bg-yellow-100 text-yellow-800',
            error: 'bg-red-100 text-red-800'
        };
        
        notification.className = `fixed top-4 right-4 ${colors[type]} px-6 py-4 rounded-lg shadow-lg z-50 flex items-center`;
        notification.innerHTML = `
            <i class="fas fa-info-circle mr-3"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
};

// Level System Management Class - Add near global variable initialization
class LevelSystem {
    constructor() {
        this.levelKey = 'jiorkLevelSystem';
        this.checkinKey = 'jiorkDailyCheckin';
        this.firstQuestionKey = 'jiorkFirstQuestionToday';
        this.levelData = {
            level: 1,
            exp: 0,
            totalExp: 0,
            lastCheckin: null,
            firstQuestionToday: null
        };
        this.loadLevelData();
        this.initLevelSystem();
        this.checkAndSetProLevel();
    }
    
    loadLevelData() {
        try {
            const saved = localStorage.getItem(this.levelKey);
            if (saved) {
                this.levelData = { ...this.levelData, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Error loading level data:', e);
        }
    }

    checkAndSetProLevel() {
        if (membershipSystem && membershipSystem.checkMembership()) {
            if (this.levelData.level !== 10) {
                this.levelData.level = 10;
                this.levelData.exp = 0;
                this.levelData.totalExp = 99999999;
                this.saveLevelData();
                this.updateLevelUI();
                this.applyAvatarFrame();
                this.updateUserTitle();
                this.unlockTiebaStyle();
                // Delay notification to avoid affecting DOM
                setTimeout(() => {
                    this.showBenefitNotification('Pro users automatically get max level privileges!');
                }, 3000);
            }
        }
    }
    
    saveLevelData() {
        try {
            localStorage.setItem(this.levelKey, JSON.stringify(this.levelData));
        } catch (e) {
            console.error('Error saving level data:', e);
        }
    }
    
    getExpRequiredForLevel(level) {
        if (level <= 1) return 0;
        if (level <= 3) return 100;
        if (level <= 5) return 200;
        if (level <= 9) return 250;
        if (level === 10) return 99999999; // Easter egg
        return 300;
    }
    
    getLevelTitle(level) {
        const titles = {
            1: 'Beginner',
            2: 'Getting Started',
            3: 'Making Progress',
            4: 'Getting Better',
            5: 'Avatar Master',
            6: 'Experienced User',
            7: 'AI Expert',
            8: 'Super User',
            9: 'Forum Veteran',
            10: 'Pro User'
        };
        return titles[level] || 'Unknown Level';
    }
    
    addExp(amount, reason = '') {
        // Pro users don't need experience system
        if (membershipSystem && membershipSystem.checkMembership()) {
            if (this.levelData.level !== 10) {
                this.checkAndSetProLevel();
            }
            return;
        }

        const oldLevel = this.levelData.level;
        this.levelData.exp += amount;
        this.levelData.totalExp += amount;
        
        // Check if level up
        while (this.canLevelUp()) {
            this.levelUp();
        }
        
        this.saveLevelData();
        this.updateLevelUI();
        
        // Show level up message if leveled up
        if (this.levelData.level > oldLevel) {
            this.showLevelUpNotification(oldLevel, this.levelData.level);
        }
        
        // Show exp gain notification
        if (reason) {
            this.showExpGainNotification(amount, reason);
        }
    }
    
    canLevelUp() {
        if (this.levelData.level >= 10) return false;
        const requiredExp = this.getExpRequiredForLevel(this.levelData.level + 1);
        return this.levelData.exp >= requiredExp;
    }
    
    levelUp() {
        const requiredExp = this.getExpRequiredForLevel(this.levelData.level + 1);
        this.levelData.exp -= requiredExp;
        this.levelData.level++;
        
        // Apply level benefits
        this.applyLevelBenefits(this.levelData.level);
        
        // Check level achievement
        if (typeof achievementSystem !== 'undefined' && achievementSystem) {
            achievementSystem.check('level', { level: this.levelData.level });
        }
    }
    
    applyLevelBenefits(level) {
        if (level === 3) {
            // Add 1000 points daily
            pointsSystem.addPoints(1000);
            this.showBenefitNotification('Get 1000 points daily reward!');
        } else if (level === 5) {
            // Unlock avatar frame
            this.applyAvatarFrame();
            this.showBenefitNotification('Unlock colorful avatar frame!');
        } else if (level === 7) {
            // Exclusive title + 2000 points daily
            pointsSystem.addPoints(2000);
            this.updateUserTitle();
            this.showBenefitNotification('Get "AI Master" title and 2000 points daily!');
        } else if (level === 9) {
            // Unlock forum veteran style
            this.unlockTiebaStyle();
            this.showBenefitNotification('Unlock forum veteran exclusive style!');
        } else if (level === 10) {
            // Pro user
            membershipSystem.activateMembership('LEVEL-10-AUTO-PRO');
            this.showBenefitNotification('Congratulations! Successfully upgraded to Pro!');
        }
    }
    
    applyAvatarFrame() {
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && this.levelData.level >= 5) {
            userAvatar.className = 'user-avatar avatar-frame-level5';
        }
    }
    
    updateUserTitle() {
        if (this.levelData.level >= 7) {
            const userNickname = document.getElementById('userNickname');
            const nickname = localStorage.getItem('jiorkUserNickname') || 'User';
            userNickname.innerHTML = `<span class="special-title">AI Master</span> ${nickname}`;
        }
    }
    
    unlockTiebaStyle() {
        // Add forum veteran style to selectors
        const styleSelectors = ['styleSelector', 'replyStyleSelector'];
        
        styleSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                const options = selector.querySelector('.dropdown-options');
                
                // Check if already added
                if (!options.querySelector('[data-value="tieba"]')) {
                    const tiebaOption = document.createElement('div');
                    tiebaOption.className = 'dropdown-option';
                    tiebaOption.dataset.value = 'tieba';
                    tiebaOption.innerHTML = '<i class="fas fa-fire mr-2"></i>Forum Veteran Style';
                    
                    options.appendChild(tiebaOption);
                    
                    // Bind click event
                    tiebaOption.addEventListener('click', () => {
                        const allOptions = options.querySelectorAll('.dropdown-option');
                        allOptions.forEach(opt => opt.classList.remove('selected'));
                        tiebaOption.classList.add('selected');
                        options.classList.remove('open');
                    });
                }
            }
        });
    }
    
    dailyCheckin() {
        // Add at the beginning of the method
        if (membershipSystem && membershipSystem.checkMembership()) {
            return { success: false, message: 'Pro users already enjoy max level privileges, no check-in needed!' };
        }
        
        const today = new Date().toDateString();
        
        if (this.levelData.lastCheckin === today) {
            return { success: false, message: 'Already checked in today!' };
        }
        
        this.levelData.lastCheckin = today;
        this.addExp(100, 'Daily Check-in');
        
        // Check consecutive check-in achievement
        if (typeof achievementSystem !== 'undefined' && achievementSystem) {
            achievementSystem.check('dailyCheckIn');
        }
        
        return { success: true, message: 'Check-in successful! Get 100 EXP' };
    }
    
    checkFirstQuestionToday() {
        const today = new Date().toDateString();
        
        if (this.levelData.firstQuestionToday !== today) {
            this.levelData.firstQuestionToday = today;
            this.addExp(10, 'First Question Today');
            this.saveLevelData();
        }
    }
    
    updateLevelUI() {
        const levelEl = document.getElementById('userLevel');
        const titleEl = document.getElementById('levelTitle');
        const progressEl = document.getElementById('levelProgressFill');
        const expTextEl = document.getElementById('levelExpText');
        const checkinBtn = document.getElementById('checkinBtn');
        
        if (levelEl) levelEl.textContent = this.levelData.level;
        if (titleEl) titleEl.textContent = this.getLevelTitle(this.levelData.level);
        
        // Update progress bar
        const requiredExp = this.getExpRequiredForLevel(this.levelData.level + 1);
        let progress = 0;
        
        if (this.levelData.level < 10) {
            progress = (this.levelData.exp / requiredExp) * 100;
            if (expTextEl) {
                expTextEl.textContent = `${this.levelData.exp} / ${requiredExp} EXP`;
            }
        } else {
            progress = 100;
            if (expTextEl) {
                expTextEl.textContent = 'MAX LEVEL';
            }
        }
        
        if (progressEl) {
            progressEl.style.width = Math.min(progress, 100) + '%';
        }
        
        // Update check-in button status
        if (checkinBtn) {
            const today = new Date().toDateString();
            if (this.levelData.lastCheckin === today) {
                checkinBtn.textContent = 'Checked In Today';
                checkinBtn.disabled = true;
                checkinBtn.classList.add('checked-in');
            } else {
                checkinBtn.innerHTML = '<i class="fas fa-calendar-check mr-2"></i>Daily Check-in';
                checkinBtn.disabled = false;
                checkinBtn.classList.remove('checked-in');
            }
        }
        
        // Apply level privilege UI
        this.applyAvatarFrame();
        this.updateUserTitle();
    }
    
    showLevelUpNotification(oldLevel, newLevel) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center';
        notification.innerHTML = `
            <i class="fas fa-trophy mr-3 text-yellow-300"></i>
            <div>
                <div class="font-bold">Congratulations on leveling up!</div>
                <div class="text-sm">Level ${oldLevel} → ${newLevel}</div>
                <div class="text-xs">${this.getLevelTitle(newLevel)}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }
    
    showExpGainNotification(amount, reason) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 right-4 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center';
        notification.innerHTML = `
            <i class="fas fa-plus-circle mr-2"></i>
            <span>+${amount} EXP (${reason})</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }
    
    showBenefitNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center';
        notification.innerHTML = `
            <i class="fas fa-gift mr-3"></i>
            <div class="font-bold">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }
    
    initLevelSystem() {
        this.updateLevelUI();
        
        // Bind check-in button event
        const checkinBtn = document.getElementById('checkinBtn');
        if (checkinBtn) {
            checkinBtn.addEventListener('click', () => {
                const result = this.dailyCheckin();
                
                if (result.success) {
                    checkinBtn.textContent = 'Checked In Today';
                    checkinBtn.disabled = true;
                    checkinBtn.classList.add('checked-in');
                } else {
                    // Show already checked in notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed top-4 right-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg z-50';
                    notification.textContent = result.message;
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.style.opacity = '0';
                        notification.style.transition = 'opacity 0.5s';
                        setTimeout(() => notification.remove(), 500);
                    }, 2000);
                }
            });
        }
    }
}

// ==================== JorkAI Debug System ====================
// Add this system at the beginning of <script> tag

// First create a temporary Debug object to prevent initialization errors
window.Debug = {
    error: (msg, data) => console.error(`[DEBUG] ${msg}`, data),
    warn: (msg, data) => console.warn(`[DEBUG] ${msg}`, data),
    success: (msg, data) => console.log(`[DEBUG] ${msg}`, data),
    info: (msg, data) => console.log(`[DEBUG] ${msg}`, data),
    debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data),
    api: (msg, data) => console.log(`[DEBUG] ${msg}`, data),
    storage: (msg, data) => console.log(`[DEBUG] ${msg}`, data),
    perf: (msg, data) => console.log(`[DEBUG] ${msg}`, data)
};

class JorkDebugSystem {
    constructor() {
        this.version = '1.0.0';
        this.startTime = Date.now();
        this.errors = [];
        this.warnings = [];
        this.apiCalls = [];
        this.performanceMarks = {};
        this.criticalPaths = new Map();
        
        // Initialize console styles - this will override the temporary Debug object
        this.initConsoleStyles();
        
        // Start various monitoring
        this.initErrorMonitoring();
        this.initPerformanceMonitoring();
        this.initStorageMonitoring();
        this.initDOMMonitoring();
        
        // Show welcome info
        this.showWelcome();
        
        // Bind shortcuts
        this.bindShortcuts();
    }
    
    // Console beautification
    initConsoleStyles() {
        // Define various styles
        this.styles = {
            error: 'background: #ff4444; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold;',
            warning: 'background: #ff9800; color: white; padding: 5px 10px; border-radius: 3px;',
            success: 'background: #4caf50; color: white; padding: 5px 10px; border-radius: 3px;',
            info: 'background: #2196f3; color: white; padding: 5px 10px; border-radius: 3px;',
            debug: 'background: #9c27b0; color: white; padding: 5px 10px; border-radius: 3px;',
            api: 'background: #ff5722; color: white; padding: 5px 10px; border-radius: 3px;',
            storage: 'background: #795548; color: white; padding: 5px 10px; border-radius: 3px;',
            performance: 'background: #607d8b; color: white; padding: 5px 10px; border-radius: 3px;'
        };
        
        // Create custom log methods - override temporary object
        window.Debug = {
            error: (msg, data) => this.log('error', msg, data),
            warn: (msg, data) => this.log('warning', msg, data),
            success: (msg, data) => this.log('success', msg, data),
            info: (msg, data) => this.log('info', msg, data),
            debug: (msg, data) => this.log('debug', msg, data),
            api: (msg, data) => this.log('api', msg, data),
            storage: (msg, data) => this.log('storage', msg, data),
            perf: (msg, data) => this.log('performance', msg, data)
        };
    }
    
    log(type, message, data) {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3 
        });
        
        console.log(
            `%c[${timestamp}] ${type.toUpperCase()}: ${message}`,
            this.styles[type]
        );
        
        if (data) {
            console.log('📊 Detailed data:', data);
        }
        
        // Record to history
        if (type === 'error') {
            this.errors.push({ time: Date.now(), message, data });
        } else if (type === 'warning') {
            this.warnings.push({ time: Date.now(), message, data });
        }
    }
    
    // Error monitoring
    initErrorMonitoring() {
        // Capture synchronous errors
        window.addEventListener('error', (event) => {
            Debug.error(`❌ JavaScript Error: ${event.message}`, {
                File: event.filename,
                Line: event.lineno,
                Column: event.colno,
                Error: event.error,
                Stack: event.error?.stack
            });
            
            // Special error detection
            this.checkSpecialErrors(event.error);
        });
        
        // Capture Promise errors
        window.addEventListener('unhandledrejection', (event) => {
            Debug.error(`❌ Promise Error: ${event.reason}`, {
                promise: event.promise,
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
        
        // Rewrite console.error to enhance error info
        const originalError = console.error;
        console.error = (...args) => {
            Debug.error('Console Error', args);
            originalError.apply(console, args);
        };
    }
    
    // Check special errors (like Set issue you encountered)
    checkSpecialErrors(error) {
        if (error?.message?.includes('is not a function')) {
            Debug.warn('🔍 Possible data type error', {
                hint: 'Check if Set/Map objects are being serialized',
                solution: [
                    '1. Check localStorage data',
                    '2. See if Set is being JSON.stringify',
                    '3. Use Debug.checkStorage() to check storage'
                ]
            });
        }
        
        if (error?.message?.includes('localStorage')) {
            Debug.warn('💾 Storage error', {
                possibleReasons: [
                    'Storage space full',
                    'Data corrupted',
                    'Privacy mode'
                ],
                suggestion: 'Use Debug.checkStorage() to check'
            });
        }
    }
    
    // Performance monitoring
    initPerformanceMonitoring() {
        // API call performance monitoring
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            const requestId = Math.random().toString(36).substr(2, 9);
            
            Debug.api(`🚀 API Request Started [${requestId}]`, {
                URL: args[0],
                Method: args[1]?.method || 'GET'
            });
            
            try {
                const response = await originalFetch(...args);
                const duration = performance.now() - startTime;
                
                Debug.api(`✅ API Request Completed [${requestId}]`, {
                    Duration: `${duration.toFixed(2)}ms`,
                    Status: response.status,
                    URL: args[0]
                });
                
                // Record slow requests
                if (duration > 3000) {
                    Debug.warn('🐌 Slow API Request', {
                        URL: args[0],
                        Duration: `${duration.toFixed(2)}ms`
                    });
                }
                
                return response;
            } catch (error) {
                Debug.error(`❌ API Request Failed [${requestId}]`, {
                    URL: args[0],
                    Error: error.message
                });
                throw error;
            }
        };
    }
    
    // Storage monitoring
    initStorageMonitoring() {
        // Monitor localStorage
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            try {
                // Check data size
                const size = new Blob([value]).size;
                Debug.storage(`💾 Store data: ${key}`, {
                    Size: `${(size / 1024).toFixed(2)}KB`,
                    Preview: value.substring(0, 100) + '...'
                });
                
                // Check special objects
                if (value.includes('[object Set]') || value.includes('[object Map]')) {
                    Debug.error('⚠️ Detected Set/Map serialization issue!', {
                        key,
                        suggestion: 'Use Array.from() to convert Set to array'
                    });
                }
                
                originalSetItem.apply(localStorage, [key, value]);
            } catch (e) {
                Debug.error('Storage failed', { key, error: e.message });
                throw e;
            }
        };
    }
    
    // DOM monitoring
    initDOMMonitoring() {
        // Monitor critical DOM elements
        const criticalElements = [
            'chatView', 'userInput', 'sendButton', 'responseContent'
        ];
        
        // Periodically check critical elements
        setInterval(() => {
            const missing = criticalElements.filter(id => !document.getElementById(id));
            if (missing.length > 0) {
                Debug.warn('🔍 Critical DOM elements missing', {
                    missingElements: missing,
                    suggestion: 'Check if DOM operations are correct'
                });
            }
        }, 5000);
    }
    
    // Show welcome info
    showWelcome() {
        console.log(
            '%c🚀 JorkAI Debug System Started!',
            'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; border-radius: 5px; font-size: 16px; font-weight: bold;'
        );
        
        console.log(
            '%c📌 Quick Commands:\n' +
            '• Debug.help() - Show all debug commands\n' +
            '• Debug.status() - Check system status\n' +
            '• Debug.checkStorage() - Check storage issues\n' +
            '• Debug.checkAPI() - Check API status\n' +
            '• Debug.quickFix() - 🆕 One-click fix common issues\n' +
            '• Debug.report() - Generate error report\n' +
            '• Ctrl+Shift+D - Show debug panel',
            'color: #5D5CDE; font-size: 12px; line-height: 1.5;'
        );
    }
    
    // Bind shortcuts
    bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D show debug panel
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.showDebugPanel();
            }
            
            // Ctrl+Shift+S show storage status
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                Debug.checkStorage();
            }
        });
    }
    
    // Debug panel
    showDebugPanel() {
        // Remove if exists
        const existing = document.getElementById('jork-debug-panel');
        if (existing) {
            existing.remove();
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'jork-debug-panel';
        panel.innerHTML = `
            <style>
                #jork-debug-panel {
                    position: fixed;
                    right: 20px;
                    top: 20px;
                    width: 400px;
                    max-height: 80vh;
                    background: rgba(255, 255, 255, 0.95);
                    border: 2px solid #5D5CDE;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    z-index: 99999;
                    font-family: monospace;
                    overflow: hidden;
                }
                
                .debug-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .debug-content {
                    padding: 15px;
                    max-height: calc(80vh - 60px);
                    overflow-y: auto;
                }
                
                .debug-section {
                    margin-bottom: 15px;
                    padding: 10px;
                    background: #f5f5f5;
                    border-radius: 5px;
                }
                
                .debug-section h3 {
                    margin: 0 0 10px 0;
                    color: #5D5CDE;
                    font-size: 14px;
                }
                
                .debug-item {
                    margin: 5px 0;
                    padding: 5px;
                    background: white;
                    border-radius: 3px;
                    font-size: 12px;
                }
                
                .debug-error {
                    color: #ff4444;
                    font-weight: bold;
                }
                
                .debug-warning {
                    color: #ff9800;
                }
                
                .debug-success {
                    color: #4caf50;
                }
                
                .debug-close {
                    cursor: pointer;
                    font-size: 20px;
                }
            </style>
            
            <div class="debug-header">
                <span>🔍 JorkAI Debug Panel</span>
                <span class="debug-close" onclick="this.parentElement.parentElement.remove()">✖</span>
            </div>
            
            <div class="debug-content">
                <div class="debug-section">
                    <h3>📊 System Status</h3>
                    <div class="debug-item">
                        Runtime: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s
                    </div>
                    <div class="debug-item">
                        Errors: <span class="debug-error">${this.errors.length}</span>
                    </div>
                    <div class="debug-item">
                        Warnings: <span class="debug-warning">${this.warnings.length}</span>
                    </div>
                    <div class="debug-item">
                        Memory Usage: ${this.getMemoryUsage()}
                    </div>
                </div>
                
                <div class="debug-section">
                    <h3>🔥 Recent Errors</h3>
                    ${this.errors.slice(-5).map(e => `
                        <div class="debug-item debug-error">
                            ${new Date(e.time).toLocaleTimeString()}: ${e.message}
                        </div>
                    `).join('') || '<div class="debug-item debug-success">No errors ✅</div>'}
                </div>
                
                <div class="debug-section">
                    <h3>⚡ Quick Actions</h3>
                    <button onclick="Debug.checkStorage()" style="margin: 5px;">Check Storage</button>
                    <button onclick="Debug.checkAPI()" style="margin: 5px;">Test API</button>
                    <button onclick="Debug.quickFix()" style="margin: 5px; background: #4caf50; color: white; border: none; padding: 5px 10px; border-radius: 3px;">🔧 Quick Fix</button>
                    <button onclick="Debug.clearErrors()" style="margin: 5px;">Clear Errors</button>
                    <button onclick="Debug.report()" style="margin: 5px;">Generate Report</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    // Get memory usage (if supported)
    getMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1048576;
            const total = performance.memory.totalJSHeapSize / 1048576;
            return `${used.toFixed(1)}MB / ${total.toFixed(1)}MB`;
        }
        return 'Not supported';
    }
}

// ==================== Debug Tool Methods ====================

// Help info
Debug.help = function() {
    console.log(
        '%c🛠️ JorkAI Debug Commands',
        'background: #2196f3; color: white; padding: 10px; border-radius: 5px; font-size: 14px; font-weight: bold;'
    );
    
    const commands = [
        { cmd: 'Debug.status()', desc: 'Check overall system status' },
        { cmd: 'Debug.checkStorage()', desc: 'Check localStorage issues (especially Set/Map serialization)' },
        { cmd: 'Debug.checkAPI()', desc: 'Test all API connection status' },
        { cmd: 'Debug.checkChat()', desc: 'Check chat system status' },
        { cmd: 'Debug.checkMemory()', desc: 'Check AI memory system' },
        { cmd: 'Debug.checkAchievements()', desc: 'Check achievement system (your Set issue is here)' },
        { cmd: 'Debug.report()', desc: 'Generate complete error report' },
        { cmd: 'Debug.clearErrors()', desc: 'Clear error records' },
        { cmd: 'Debug.monitor(function)', desc: 'Monitor specific function execution' },
        { cmd: 'Debug.trace()', desc: 'Trace current execution stack' },
        { cmd: 'Debug.fixStorage()', desc: 'Try to fix storage issues' },
        { cmd: 'Debug.quickFix()', desc: '🆕 One-click fix common issues' }
    ];
    
    console.table(commands);
};

// System status (safe retrieval method)
Debug.status = function() {
    const safeGet = (obj, path, defaultValue = 'Unknown') => {
        try {
            return path.split('.').reduce((o, p) => o?.[p], obj) ?? defaultValue;
        } catch {
            return defaultValue;
        }
    };
    
    const status = {
        'Membership Status': safeGet(window, 'membershipSystem.checkMembership') ? 'Pro User' : 'Free User',
        'Points': safeGet(window, 'pointsSystem.getCurrentPoints.remaining', 'Unknown'),
        'Level': safeGet(window, 'levelSystem.levelData.level', 'Unknown'),
        'Chats': safeGet(window, 'chatManager.chatHistory.length', 0),
        'Memories': safeGet(window, 'memoryManager.memories.length', 0),
        'Achievements Unlocked': safeGet(window, 'achievementSystem.getUnlockedCount', 0),
        'Current Model': window.globalSelectedModel || 'Not selected',
        'Dark Mode': document.documentElement.classList.contains('dark'),
        'Errors': window.debugSystem?.errors?.length || 0
    };
    
    console.log('%c📊 System Status', 'background: #4caf50; color: white; padding: 5px 10px; border-radius: 3px;');
    console.table(status);
};

// Check storage issues (specifically for Set serialization issue you encountered)
Debug.checkStorage = function() {
    console.log('%c💾 Storage Check Started', 'background: #795548; color: white; padding: 5px 10px; border-radius: 3px;');
    
    const problems = [];
    
    // Check each localStorage item
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        
        try {
            // Try to parse
            const parsed = JSON.parse(value);
            
            // Check Set/Map serialization issues
            if (value.includes('[object Set]') || value.includes('[object Map]')) {
                problems.push({
                    key,
                    issue: 'Set/Map serialization error',
                    suggestion: 'Use Array.from() to convert'
                });
            }
            
            // Check data size
            const size = new Blob([value]).size;
            if (size > 100000) { // 100KB
                problems.push({
                    key,
                    issue: `Data too large: ${(size/1024).toFixed(1)}KB`,
                    suggestion: 'Consider cleaning or compressing'
                });
            }
            
        } catch (e) {
            problems.push({
                key,
                issue: 'JSON parse failed',
                suggestion: 'Data may be corrupted'
            });
        }
    }
    
    if (problems.length > 0) {
        console.log('%c❌ Storage issues found:', 'color: red; font-weight: bold;');
        console.table(problems);
    } else {
        console.log('%c✅ Storage status is good!', 'color: green; font-weight: bold;');
    }
    
    // Show storage usage
    const usage = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const size = new Blob([localStorage.getItem(key)]).size;
        usage[key] = `${(size/1024).toFixed(2)}KB`;
    }
    
    console.log('%c📊 Storage usage details:', 'background: #2196f3; color: white; padding: 5px 10px; border-radius: 3px;');
    console.table(usage);
};

// Check API status
Debug.checkAPI = async function() {
    console.log('%c🚀 API Check Started', 'background: #ff5722; color: white; padding: 5px 10px; border-radius: 3px;');
    
    // Check if API config exists
    if (!window.API_CONFIG) {
        console.error('❌ API_CONFIG not defined!');
        return;
    }
    
    const apis = [
        { name: 'linkapi', displayName: 'LinkAPI (Main Model)', endpoint: '/models' },
        { name: 'deepseek', displayName: 'DeepSeek API', endpoint: '/models' },
        { name: 'jeniya', displayName: 'Jeniya (Image)', endpoint: '/models' }
    ];
    
    for (const api of apis) {
        try {
            if (!API_CONFIG[api.name]) {
                console.log(`%c⚠️ ${api.displayName}: Config not found`, 'color: orange;');
                continue;
            }
            
            const start = performance.now();
            const response = await fetch(API_CONFIG[api.name].baseUrl + api.endpoint, {
                headers: {
                    'Authorization': `Bearer ${API_CONFIG[api.name].apiKey}`
                }
            });
            const time = performance.now() - start;
            
            console.log(
                `%c✅ ${api.displayName}: ${response.status} (${time.toFixed(0)}ms)`,
                'color: green;'
            );
        } catch (e) {
            console.log(
                `%c❌ ${api.displayName}: Connection failed - ${e.message}`,
                'color: red;'
            );
        }
    }
};

// Check chat system
Debug.checkChat = function() {
    console.log('%c💬 Chat System Check', 'background: #9c27b0; color: white; padding: 5px 10px; border-radius: 3px;');
    
    const chatStatus = {
        'Current Chat ID': window.chatManager?.currentChatId || 'None',
        'Message Count': window.chatManager?.currentMessages?.length || 0,
        'History Chat Count': window.chatManager?.chatHistory?.length || 0,
        'Is Sending': window.isSending || false,
        'Active Requests': window.requestManager?.activeRequests?.size || 0
    };
    
    console.table(chatStatus);
    
    // Check critical DOM
    const elements = {
        'userInput': !!document.getElementById('userInput'),
        'sendButton': !!document.getElementById('sendButton'),
        'chatView': !!document.getElementById('chatView'),
        'responseContent': !!document.getElementById('responseContent')
    };
    
    console.log('%c🔍 DOM Element Status:', 'font-weight: bold;');
    console.table(elements);
};

// Check achievement system (your Set issue is here)
Debug.checkAchievements = function() {
    console.log('%c🏆 Achievement System Check', 'background: #ff9800; color: white; padding: 5px 10px; border-radius: 3px;');
    
    if (!window.achievementSystem) {
        console.error('Achievement system not initialized!');
        return;
    }
    
    // Check explorer achievement progress (Set issue)
    const explorer = achievementSystem.achievements.explorer;
    if (explorer) {
        console.log('Explorer achievement status:', {
            progress: explorer.progress,
            isSet: explorer.progress instanceof Set,
            size: explorer.progress instanceof Set ? explorer.progress.size : 'N/A',
            rawData: localStorage.getItem('jiorkAchievements')
        });
    }
    
    // Show all achievement status
    const achievementStatus = {};
    Object.entries(achievementSystem.achievements).forEach(([key, achievement]) => {
        achievementStatus[key] = {
            unlocked: achievement.unlocked,
            progress: achievement.progress || 0,
            target: achievement.target || '-'
        };
    });
    
    console.table(achievementStatus);
};

// Generate error report
Debug.report = function() {
    const report = {
        time: new Date().toLocaleString(),
        systemInfo: {
            browser: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language
        },
        errorStats: {
            errors: window.debugSystem?.errors?.length || 0,
            warnings: window.debugSystem?.warnings?.length || 0,
            recentErrors: window.debugSystem?.errors?.slice(-3) || []
        },
        storageStatus: {
            totalSize: Object.keys(localStorage).reduce((total, key) => {
                return total + new Blob([localStorage.getItem(key)]).size;
            }, 0) / 1024 + 'KB',
            itemCount: localStorage.length
        },
        systemStatus: {
            membership: window.membershipSystem?.checkMembership?.() ? 'Pro' : 'Free',
            points: window.pointsSystem?.getCurrentPoints?.()?.remaining || 'Unknown',
            level: window.levelSystem?.levelData?.level || 'Unknown'
        }
    };
    
    console.log('%c📋 Error Report', 'background: #f44336; color: white; padding: 10px; border-radius: 5px; font-size: 14px;');
    console.log(JSON.stringify(report, null, 2));
    
    // Try to copy to clipboard (may fail due to permissions)
    try {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(JSON.stringify(report, null, 2))
                .then(() => console.log('%c✅ Report copied to clipboard', 'color: green;'))
                .catch(() => console.log('%c⚠️ Cannot copy to clipboard (insufficient permissions)', 'color: orange;'));
        } else {
            console.log('%c⚠️ Clipboard API not available (requires HTTPS or localhost)', 'color: orange;');
        }
    } catch (e) {
        console.log('%c⚠️ Clipboard operation failed', 'color: orange;');
    }
};

// Fix storage issues
Debug.fixStorage = function() {
    console.log('%c🔧 Trying to fix storage issues...', 'background: #ff5722; color: white; padding: 5px 10px; border-radius: 3px;');
    
    // Fix achievement system Set issue
    try {
        const achievements = localStorage.getItem('jiorkAchievements');
        if (achievements) {
            const parsed = JSON.parse(achievements);
            
            // Fix explorer progress
            if (parsed.explorer && parsed.explorer.progress && Array.isArray(parsed.explorer.progress)) {
                console.log('✅ Fix explorer achievement Set issue');
                // progress is already array, keep unchanged
            }
            
            localStorage.setItem('jiorkAchievements', JSON.stringify(parsed));
        }
        
        console.log('%c✅ Storage fix completed', 'color: green; font-weight: bold;');
    } catch (e) {
        console.error('Fix failed:', e);
    }
};

// Clear errors
Debug.clearErrors = function() {
    if (window.debugSystem) {
        window.debugSystem.errors = [];
        window.debugSystem.warnings = [];
    }
    console.clear();
    console.log('%c✅ Errors cleared', 'color: green; font-weight: bold;');
};

// Monitor function execution
Debug.monitor = function(funcName) {
    const parts = funcName.split('.');
    let obj = window;
    let method = funcName;
    
    if (parts.length > 1) {
        method = parts.pop();
        obj = parts.reduce((o, p) => o?.[p], window);
    }
    
    if (!obj || !obj[method]) {
        console.error(`Function ${funcName} does not exist`);
        return;
    }
    
    const original = obj[method];
    
    obj[method] = function(...args) {
        console.log(`%c🔍 Calling ${funcName}`, 'background: #2196f3; color: white; padding: 3px 8px; border-radius: 3px;', {
            parameters: args,
            callStack: new Error().stack
        });
        
        const start = performance.now();
        try {
            const result = original.apply(this, args);
            const duration = performance.now() - start;
            
            console.log(`%c✅ ${funcName} completed (${duration.toFixed(2)}ms)`, 'color: green;', {
                returnValue: result
            });
            
            return result;
        } catch (e) {
            console.error(`%c❌ ${funcName} error`, 'color: red;', e);
            throw e;
        }
    };
    
    console.log(`%cMonitoring started: ${funcName}`, 'color: blue;');
};

// Trace execution stack
Debug.trace = function() {
    console.trace('🔍 Current execution stack');
};

// Quick fix common issues
Debug.quickFix = function() {
    console.log('%c🚀 Starting quick fix...', 'background: #4caf50; color: white; padding: 5px 10px; border-radius: 3px;');
    
    let fixCount = 0;
    
    // 1. Fix Set serialization issue
    try {
        const achievements = localStorage.getItem('jiorkAchievements');
        if (achievements && achievements.includes('[object Set]')) {
            console.log('🔧 Fixing achievement system Set serialization...');
            const fixed = achievements.replace(/\[object Set\]/g, '[]');
            localStorage.setItem('jiorkAchievements', fixed);
            fixCount++;
        }
    } catch (e) {
        console.error('Failed to fix achievement system:', e);
    }
    
    // 2. Clean corrupted localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        try {
            JSON.parse(value);
        } catch {
            if (value.includes('[object') || value === 'undefined') {
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => {
        console.log(`🗑️ Removing corrupted storage item: ${key}`);
        localStorage.removeItem(key);
        fixCount++;
    });
    
    // 3. Fix common undefined values
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (localStorage.getItem(key) === 'undefined') {
            localStorage.removeItem(key);
            console.log(`🗑️ Removing undefined value: ${key}`);
            fixCount++;
        }
    }
    
    console.log(`%c✅ Quick fix completed! Fixed ${fixCount} issues`, 'color: green; font-weight: bold;');
    
    if (fixCount > 0) {
        console.log('%c🔄 Recommend refreshing the page to apply fixes', 'color: blue;');
    }
};

// ==================== Start Debug System ====================
window.debugSystem = new JorkDebugSystem();

// ==================== Safe Function Wrapping ====================

// Wait for main system to load before wrapping functions
window.addEventListener('DOMContentLoaded', () => {
    // Protect sendMessage function (if exists)
    if (window.sendMessage) {
        const originalSendMessage = window.sendMessage;
        window.sendMessage = async function(...args) {
            Debug.info('📤 Starting to send message', {
                messageContent: args[0]?.value,
                model: window.globalSelectedModel
            });
            
            try {
                const result = await originalSendMessage.apply(this, args);
                Debug.success('✅ Message sent successfully');
                return result;
            } catch (e) {
                Debug.error('❌ Message send failed', {
                    error: e.message,
                    stack: e.stack
                });
                throw e;
            }
        };
    }
});

// ==================== Delayed Checks ====================

// Check system integrity
setTimeout(() => {
    const missingGlobals = [];
    const expectedGlobals = [
        'membershipSystem',
        'pointsSystem', 
        'levelSystem',
        'chatManager',
        'memoryManager',
        'achievementSystem',
        'API_CONFIG'
    ];
    
    expectedGlobals.forEach(global => {
        if (!window[global]) {
            missingGlobals.push(global);
        }
    });
    
    if (missingGlobals.length > 0) {
        Debug.warn('⚠️ Detected missing global objects', {
            missingObjects: missingGlobals,
            suggestion: 'Ensure all systems are properly initialized after debug system'
        });
    }
}, 1000);

// Check achievement system after initialization (delayed load)
setTimeout(() => {
    if (window.achievementSystem) {
        const explorer = window.achievementSystem.achievements?.explorer;
        if (explorer?.progress && !(explorer.progress instanceof Set)) {
            Debug.warn('⚠️ Detected achievement system Set issue!', {
                currentType: typeof explorer.progress,
                isArray: Array.isArray(explorer.progress),
                suggestion: 'Run Debug.fixStorage() to fix'
            });
        }
    }
}, 3000); // Increase delay time

// =================== JorkAI Debug System Complete =========================

        let messages = [];
        // Mount globally accessible functions to window
        window.exportPersonalityCard = async function(cardId) {
            const cardEl = document.getElementById(cardId + '_card');
            if (!cardEl) {
                console.error('Card element not found:', cardId + '_card');
                return;
            }
            
            // Show watermark
            cardEl.classList.add('exporting');
            
            try {
                // Use html2canvas to generate image
                const canvas = await html2canvas(cardEl, {
                    backgroundColor: null,
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    width: cardEl.offsetWidth,
                    height: cardEl.offsetHeight
                });
                
                // Convert to image and download
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `JorkAI_PersonalityCard_${new Date().getTime()}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/jpeg', 0.95);
                
            } catch (error) {
                console.error('Export failed:', error);
                alert('Export failed, please try again');
            } finally {
                // Hide watermark
                cardEl.classList.remove('exporting');
            }
        };

        // API configuration - Update to correct models and endpoints
        const API_CONFIG = {
            linkapi: {
                baseUrl: 'https://api.linkapi.org/v1',
                apiKey: 'sk-H5JewkujpZ96zoor25C3F1EcE0F7452a8017Ab2355E18446',
                models: {
                    'Jork-Epist-4-n': 'gpt-5-nano', // Basic model
                    'Jork-Epist-4': 'grok-3-deepsearch',  // Deep reasoning search model
                    'Jork-Trax-4': 'deepseek-v3',  // Code model
                    'Aria-music': 'suno_music'  // Text-to-music model
                },
                sunoUrl: 'https://api.linkapi.org/suno'
            },
            jeniya: {
                baseUrl: 'https://jeniya.cn/v1',
                apiKey: 'sk-9OiUODVwmax1pWQOu7tM40fYy2V2MKR7W2PxYNSPsKLStscK',
                imageModel: 'dall-e-3'
            },
            deepseek: {
                baseUrl: 'https://api.deepseek.com/v1',
                apiKey: 'sk-e1ed90c2effc4415beeee85845f66d05'
            }
        };

        // Global variables
        let globalSelectedModel = 'Jork-Epist-4-n';
        let isModelSyncing = false;
        let currentCanvasCode = '';
        let canvasIsActive = false;
        let dropdownGlobalListenerAdded = false;
        let isSending = false;

        // Request Manager
        class RequestManager {
            constructor() {
                this.activeRequests = new Map();
                this.requestCounter = 0;
            }

            createRequest() {
                const requestId = ++this.requestCounter;
                const abortController = new AbortController();
                this.activeRequests.set(requestId, abortController);
                
                return {
                    id: requestId,
                    signal: abortController.signal,
                    abort: () => this.abortRequest(requestId)
                };
            }

            abortRequest(requestId) {
                const controller = this.activeRequests.get(requestId);
                if (controller) {
                    controller.abort();
                    this.activeRequests.delete(requestId);
                }
            }

            abortAllRequests() {
                for (const [id, controller] of this.activeRequests) {
                    controller.abort();
                }
                this.activeRequests.clear();
            }

            completeRequest(requestId) {
                this.activeRequests.delete(requestId);
            }
        }

        // File Manager
        class FileManager {
            constructor() {
                this.files = {
                    main: [],
                    reply: []
                };
                this.nextId = 0;
            }

            addFile(target, file) {
                const fileObj = {
                    id: ++this.nextId,
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type
                };
                this.files[target].push(fileObj);
                return fileObj;
            }

            removeFile(target, fileId) {
                const index = this.files[target].findIndex(f => f.id === fileId);
                if (index !== -1) {
                    this.files[target].splice(index, 1);
                    return true;
                }
                return false;
            }

            getFiles(target) {
                return this.files[target].slice();
            }

            clearFiles(target) {
                this.files[target] = [];
            }

            clearAllFiles() {
                this.files.main = [];
                this.files.reply = [];
            }
        }

        // Points System
        class PointsSystem {
            constructor() {
                this.pointsKey = 'jiorkPointsSystem';
                this.redeemedCodesKey = 'jiorkRedeemedCodes';
                this.initializePoints();
            }

            initializeFromSupabase(statsData) {
                const points = {
                    remaining: statsData.points,
                    resetTime: new Date(statsData.points_reset_time).getTime(),
                    lastCheck: Date.now()
                };
                
                localStorage.setItem(this.pointsKey, JSON.stringify(points));
                this.updatePointsUI(points.remaining);
            }

            async syncToSupabase() {
                const currentPoints = this.getCurrentPoints();
                
                await supabaseClient
                    .from('user_stats')
                    .update({
                        points: currentPoints.remaining,
                        points_reset_time: new Date(currentPoints.resetTime).toISOString()
                    })
                    .eq('user_id', currentUserId);
            }

            initializePoints() {
                const now = new Date();
                const localTime = new Date();
                
                const resetTime = new Date(localTime);
                resetTime.setHours(0, 0, 0, 0);
                resetTime.setDate(resetTime.getDate() + 1);

                let points = {
                    remaining: 3000,
                    resetTime: resetTime.getTime(),
                    lastCheck: now.getTime()
                };

                try {
                    const savedPoints = localStorage.getItem(this.pointsKey);
                    if (savedPoints) {
                        const parsedPoints = JSON.parse(savedPoints);
                        if (now.getTime() >= parsedPoints.resetTime) {
                            points.remaining = 3000;
                            points.resetTime = resetTime.getTime();
                        } else {
                            points = parsedPoints;
                        }
                    }
                } catch (e) {
                    console.error('Error loading points:', e);
                }

                localStorage.setItem(this.pointsKey, JSON.stringify(points));
                this.updatePointsUI(points.remaining);
            }

            canUsePoints(amount = 50) {
                if (membershipSystem.checkMembership()) {
                    return true;
                }

                const currentPoints = this.getCurrentPoints();
                return currentPoints.remaining >= amount;
            }

            deductPoints(amount = 50) {
                if (membershipSystem.checkMembership()) {
                    return true;
                }

                const currentPoints = this.getCurrentPoints();
                if (currentPoints.remaining >= amount) {
                    currentPoints.remaining -= amount;
                    currentPoints.lastCheck = new Date().getTime();
                    
                    localStorage.setItem(this.pointsKey, JSON.stringify(currentPoints));
                    this.syncToSupabase();
                    this.updatePointsUI(currentPoints.remaining);
                    return true;
                }
                return false;
            }

            refundPoints(amount = 50) {
                if (membershipSystem.checkMembership()) {
                    return;
                }

                const currentPoints = this.getCurrentPoints();
                currentPoints.remaining += amount;
                localStorage.setItem(this.pointsKey, JSON.stringify(currentPoints));
                this.updatePointsUI(currentPoints.remaining);
            }

            getCurrentPoints() {
                try {
                    const savedPoints = localStorage.getItem(this.pointsKey);
                    if (savedPoints) {
                        const points = JSON.parse(savedPoints);
                        const currentTime = new Date().getTime();
                        
                        if (currentTime >= points.resetTime) {
                            const now = new Date();
                            const localTime = new Date();
                            const resetTime = new Date(localTime);
                            resetTime.setHours(0, 0, 0, 0);
                            resetTime.setDate(resetTime.getDate() + 1);
                            
                            points.remaining = 3000;
                            points.resetTime = resetTime.getTime();
                            localStorage.setItem(this.pointsKey, JSON.stringify(points));
                        }
                        
                        return points;
                    }
                } catch (e) {
                    console.error('Error getting current points:', e);
                }
                
                return { remaining: 3000 };
            }

            updatePointsUI(remaining) {
                if (membershipSystem.checkMembership()) {
                    return;
                }

                const pointsDisplay = document.getElementById('pointsDisplay');
                const quotaWarning = document.getElementById('quotaWarning');
                const lowPointsValue = document.getElementById('lowPointsValue');
                
                if (pointsDisplay) {
                    pointsDisplay.textContent = `Points: ${remaining}`;
                }
                
                if (remaining <= 100 && quotaWarning && lowPointsValue) {
                    lowPointsValue.textContent = remaining;
                    quotaWarning.classList.remove('hidden');
                } else if (quotaWarning) {
                    quotaWarning.classList.add('hidden');
                }
            }

            addPoints(amount) {
                if (membershipSystem.checkMembership()) {
                    return Infinity;
                }

                const currentPoints = this.getCurrentPoints();
                currentPoints.remaining += amount;
                localStorage.setItem(this.pointsKey, JSON.stringify(currentPoints));
                this.updatePointsUI(currentPoints.remaining);
                return currentPoints.remaining;
            }

            redeemCode(code) {
                try {
                    const validCodes = [
                        "3xY7p9L2vN6qR1tK8mZ4sD5wF0gH7jP2bV6cX9nM4aQ8uS3eT5yJ1oG",
                        "8fB4zK7mN1pX9vL6tR2wQ5sD0hJ3gY7uP4aV9cM2bH6nT8kS5eF1oG",
                        "5tR9vL2mX6pK1wN8qZ4sD7yF0gH3jP2bV6cX9nM4aQ8uS3eT5yJ1oG",
                        // ... (keep all the codes as they are)
                    ];
                    
                    if (!validCodes.includes(code)) {
                        return { success: false, message: "Invalid redemption code" };
                    }
                    
                    const redeemedCodes = JSON.parse(localStorage.getItem(this.redeemedCodesKey)) || [];
                    if (redeemedCodes.includes(code)) {
                        return { success: false, message: "Code already used" };
                    }
                    
                    redeemedCodes.push(code);
                    localStorage.setItem(this.redeemedCodesKey, JSON.stringify(redeemedCodes));
                    this.addPoints(1000);
                    
                    return { success: true, message: "Successfully redeemed 1000 points!" };
                } catch (e) {
                    console.error('Error redeeming code:', e);
                    return { success: false, message: "Redemption failed, please try again" };
                }
            }
        }

        function updateMembershipUI(isPro) {
            const planStatus = document.getElementById('planStatus');
            const quotaContainer = document.getElementById('quotaContainer');
            
            if (isPro) {
                planStatus.innerHTML = '<span class="text-gradient bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">Pro User</span>';
                quotaContainer.style.display = 'none';
            } else {
                planStatus.innerHTML = `
                    <span class="text-gray-600 dark:text-gray-300">Free Plan</span>
                    <span>•</span>
                    <a href="#" id="upgradeLink" class="text-blue-500 hover:text-blue-600">Upgrade</a>
                `;
                
                quotaContainer.style.display = 'flex';
                
                setTimeout(() => {
                    const upgradeLink = document.getElementById('upgradeLink');
                    if (upgradeLink) {
                        upgradeLink.addEventListener('click', function(e) {
                            e.preventDefault();
                            document.getElementById('membershipModal').classList.remove('hidden');
                        });
                    }
                }, 0);
            }
        }

        // After updateMembershipUI function add
        document.getElementById('upgradeLinkWarning')?.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('membershipModal').classList.remove('hidden');
        });

        // Local time greeting (enhanced emotional expression)
        function updateTimeGreeting() {
            const now = new Date();
            const localHour = now.getHours();
            let greeting = "";
            
            // Get user nickname
            const userNickname = localStorage.getItem('jiorkUserNickname') || '';
            // 50% chance to add username
            const includeNickname = Math.random() < 0.5 && userNickname;
            const nicknameText = includeNickname ? `, ${userNickname}` : '';
            
            if (localHour >= 5 && localHour < 9) {
                const morningGreetings = [
                    `Good morning${nicknameText}! Hope you have a wonderful start to your day.`,
                    `Rise and shine${nicknameText}! Wishing you a bright and productive morning.`,
                    `Morning greetings${nicknameText}! May your day be filled with positive energy.`,
                    `Good morning${nicknameText}! Hope your coffee tastes as good as your day ahead`
                ];
                greeting = morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
            } else if (localHour >= 9 && localHour < 12) {
                const lateMorningGreetings = [
                    `Hope your morning is going smoothly${nicknameText}!`,
                    `Mid-morning check-in${nicknameText}! How's your day shaping up?`,
                    `Good late morning${nicknameText}! Hope you're crushing your goals today.`,
                    `Hey${nicknameText}, hope your morning productivity is on point!`
                ];
                greeting = lateMorningGreetings[Math.floor(Math.random() * lateMorningGreetings.length)];
            } else if (localHour >= 12 && localHour < 14) {
                const noonGreetings = [
                    `Lunch time${nicknameText}! Hope you grab something delicious.`,
                    `Midday greetings${nicknameText}! Time to refuel and recharge.`,
                    `Hey${nicknameText}, hope you're taking a well-deserved lunch break.`,
                    `Good afternoon${nicknameText}! Don't forget to treat yourself to a good meal.`
                ];
                greeting = noonGreetings[Math.floor(Math.random() * noonGreetings.length)];
            } else if (localHour >= 14 && localHour < 18) {
                const afternoonGreetings = [
                    `Good afternoon${nicknameText}! Hope the rest of your day goes smoothly.`,
                    `Afternoon vibes${nicknameText}! You're doing great today.`,
                    `Hey${nicknameText}, hope your afternoon is as awesome as you are.`,
                    `Good afternoon${nicknameText}! Almost there - you've got this!`
                ];
                greeting = afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
            } else if (localHour >= 18 && localHour < 22) {
                const eveningGreetings = [
                    `Good evening${nicknameText}! Hope you had a fantastic day.`,
                    `Evening greetings${nicknameText}! Time to unwind and relax.`,
                    `Hey${nicknameText}, hope your evening is peaceful and enjoyable.`,
                    `Good evening${nicknameText}! You've earned some quality downtime.`
                ];
                greeting = eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
            } else {
                const nightGreetings = [
                    `Still up${nicknameText}? Hope you're having a good night.`,
                    `Late night greetings${nicknameText}! Don't stay up too late.`,
                    `Hey${nicknameText}, hope your evening is treating you well.`,
                    `Midnight inspiration strikes${nicknameText}! 💫`,
                    `Good night soon${nicknameText}! Sweet dreams when you get there.`
                ];
                greeting = nightGreetings[Math.floor(Math.random() * nightGreetings.length)];
            }
            
            document.getElementById('timeGreeting').innerHTML = greeting;
        }

        // Stream Response Processor
class StreamProcessor {
    constructor() {
        this.buffer = '';
        this.fullResponse = '';
        this.thinking = [];
        this.searchSteps = [];
        this.inThinking = false;
        this.inSearch = false;
        this.currentThinkingContent = '';
        this.currentSearchContent = '';
    }

    processChunk(chunk) {
        this.buffer += chunk;
        let lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                
                if (dataStr === '[DONE]') {
                    console.log('[StreamProcessor] Stream ended');
                    continue;
                }
                
                try {
                    const parsedData = JSON.parse(dataStr);
                    
                    // ✅ Key: Get content from choices[0].delta.content
                    const content = parsedData.choices?.[0]?.delta?.content;
                    
                    if (content) {
                        console.log('[StreamProcessor] Extracted content:', content);
                        this.fullResponse += content;
                        
                        // ✅ Update DOM immediately
                        const responseContent = document.getElementById('responseContent');
                        if (responseContent) {
                            responseContent.innerHTML = marked.parse(this.fullResponse);
                            console.log('[StreamProcessor] DOM updated');
                        } else {
                            console.error('[StreamProcessor] responseContent element does not exist!');
                        }
                    }
                } catch (e) {
                    console.error('[StreamProcessor] Parse error:', e);
                }
            }
        }
    }

    processContent(content) {
        // Add content directly without any filtering
        this.fullResponse += content;
        return content;
    }

    getResult() {
        return {
            content: this.fullResponse,
            thinking: this.thinking.length > 0 ? this.thinking : null,
            searchSteps: this.searchSteps.length > 0 ? this.searchSteps : null  // New addition
        };
    }
}

// Memory Manager
class MemoryManager {
    constructor() {
        this.memoryKey = 'jiorkMemorySystem';
        this.enabledKey = 'jiorkMemoryEnabled';
        this.memories = [];
        this.enabled = true;
        this.maxMemories = 50; // Maximum 50 memories saved
        this.loadMemories();
    }
    
    loadMemories() {
        try {
            const savedMemories = localStorage.getItem(this.memoryKey);
            if (savedMemories) {
                this.memories = JSON.parse(savedMemories);
            }
            
            const enabledStatus = localStorage.getItem(this.enabledKey);
            this.enabled = enabledStatus !== 'false';
        } catch (e) {
            console.error('Error loading memories:', e);
            this.memories = [];
        }
    }

    async loadMemories() {
        try {
            const { data: memories } = await supabaseClient
                .from('ai_memories')
                .select('*')
                .eq('user_id', currentUserId)
                .order('updated_at', { ascending: false });
            
            if (memories) {
                this.memories = memories.map(m => ({
                    id: m.id,
                    message: m.message,
                    summary: m.summary,
                    userProfile: m.user_profile,
                    timestamp: m.created_at,
                    isQuote: m.is_quote,
                    quoteValue: m.quote_value,
                    occurrences: m.occurrences
                }));
                
                this.updateMemoryUI();
            }
        } catch (error) {
            console.error('Error loading memories:', error);
        }
    }

    async syncMemoryToSupabase(memory) {
        try {
            await supabaseClient
                .from('ai_memories')
                .insert({
                    user_id: currentUserId,
                    message: memory.message,
                    summary: memory.summary,
                    user_profile: memory.userProfile,
                    is_quote: memory.isQuote,
                    quote_value: memory.quoteValue,
                    occurrences: memory.occurrences
                });
        } catch (error) {
            console.error('Error syncing memory:', error);
        }
    }
    
    saveMemories() {
        try {
            const memoriesStr = JSON.stringify(this.memories);
            
            // Check size, auto-clean if over 1MB
            if (memoriesStr.length > 1024 * 1024) {
                this.memories = this.memories.slice(0, 30);
            }
            
            localStorage.setItem(this.memoryKey, JSON.stringify(this.memories));
            localStorage.setItem(this.enabledKey, this.enabled.toString());
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                // Insufficient storage space, keep only the newest 20
                console.warn('Storage quota exceeded, keeping only recent memories');
                this.memories = this.memories.slice(0, 20);
                try {
                    localStorage.setItem(this.memoryKey, JSON.stringify(this.memories));
                } catch (e2) {
                    console.error('Failed to save memories even after cleanup:', e2);
                    // Show user notification
                    this.showStorageError();
                }
            } else {
                console.error('Error saving memories:', e);
            }
        }
    }

    shouldAnalyzeMessage(message) {
        // Enhanced local pre-screening
        const keywords = ['my name', 'I am', 'my', 'like', 'dislike', 'need', 'hope', 'goal', 'work', 'career', 'hobby', 'interest', 'home', 'friend', 'learn', 'major'];
        const hasKeyword = keywords.some(keyword => message.toLowerCase().includes(keyword));
        
        // Message too short, don't analyze
        if (message.length < 3) return false;
        
        // Pure punctuation or symbols, don't analyze
        if (!/[a-zA-Z]/.test(message)) return false;
        
        // Analyze as long as it contains keywords, regardless of length
        return hasKeyword;
    }    
    
    async analyzeImportance(message) {
        if (!this.enabled) return null;
        
        try {
            const apiUrl = `${API_CONFIG.deepseek.baseUrl}/chat/completions`;
            
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.deepseek.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: `You are a memory analysis assistant. Please analyze the user's message and determine if it contains information about the user.

Important information includes:
- User's personal preferences and hobbies
- User's identity, profession, background
- User's needs, goals, pain points
- User's values and personality traits
- User's professional field or skills
- User's plans and projects
- Important life milestones
- User's quotes (literary insights, life philosophy, healing literary style, heartfelt reality) (You don't need to be too strict about quotes, just extract all philosophical ones)

Pay special attention to identifying quote features:
- Express unique viewpoints or life attitudes
- Interesting, humorous, or philosophical
- Reflect personal values or personality
- Moderate length (10-100 words) of brilliant expression

If the message contains important information, please return strictly in the following JSON format without any markdown markers:
{"important": true, "summary": "brief summary", "userProfile": "user profile analysis", "isQuote": true/false, "quoteValue": "return original text if it's a quote"}

If the message is not important, please return strictly in the following JSON format:
{"important": false}

Important: Only return JSON, do not use code block markers.`
                        },
                        { role: "user", content: message }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                let content = data.choices[0].message.content.trim();
                
                // Clean possible markdown code block markers
                content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
                
                console.log("Cleaned content:", content); // For debugging
                
                try {
                    return JSON.parse(content);
                } catch (e) {
                    console.error('JSON parse error, original content:', content);
                    return null;
                }
            }
        } catch (e) {
            console.error('Error analyzing message importance:', e);
            
            // Fallback: directly identify messages containing personal information
            const personalKeywords = ['my name', 'I am', 'my', 'like', 'dislike', 'interest', 'hobby', 'work', 'career'];
            const hasPersonalInfo = personalKeywords.some(keyword => message.toLowerCase().includes(keyword));
            
            if (hasPersonalInfo || message.length > 50) {
                return {
                    important: true,
                    summary: message.length > 50 ? message.substring(0, 47) + '...' : message,
                    userProfile: 'Personal information mentioned by user'
                };
            }
        }

        return null;
    }
    
    async addMemory(message) {
        if (!this.enabled) return;
        
        // Local pre-screening first
        if (!this.shouldAnalyzeMessage(message)) {
            return;
        }

        const analysis = await this.analyzeImportance(message);
        
        if (analysis && analysis.important) {
            const memory = {
                id: Date.now(),
                message: message,
                summary: analysis.summary,
                userProfile: analysis.userProfile,
                timestamp: new Date().toISOString(),
                isQuote: analysis.isQuote || false,
                quoteValue: analysis.quoteValue || null
            };

            // Check if there's a similar memory
            const similarIndex = this.memories.findIndex(m => 
                m.summary === analysis.summary || 
                (m.summary.length > 20 && m.summary.substring(0, 20) === analysis.summary.substring(0, 20))
            );

            if (similarIndex !== -1) {
                // Update existing memory's timestamp
                this.memories[similarIndex].timestamp = new Date().toISOString();
                this.memories[similarIndex].occurrences = (this.memories[similarIndex].occurrences || 1) + 1;
                
                // Move updated memory to the front
                const [updatedMemory] = this.memories.splice(similarIndex, 1);
                this.memories.unshift(updatedMemory);
            } else {
                // Add new memory
                this.memories.unshift(memory);
            }
            
            // Limit number of memories
            if (this.memories.length > this.maxMemories) {
                this.memories = this.memories.slice(0, this.maxMemories);
            }
            
            this.saveMemories();
            this.updateMemoryUI();
            
            // Show memory saved notification
            this.showMemorySavedNotification(analysis.summary);
            // Sync to Supabase
            this.syncMemoryToSupabase(memory);
        }
    }
    
    showMemorySavedNotification(summary) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center';
        notification.innerHTML = `
            <i class="fas fa-brain mr-2"></i>
            <span>Remembered: ${summary}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
    
    getMemoryContext() {
        if (!this.enabled || this.memories.length === 0) return '';
        
        const recentMemories = this.memories.slice(0, 10);
        let context = 'Based on my understanding of the user:\n';
        
        recentMemories.forEach(memory => {
            context += `- ${memory.summary} (${memory.userProfile})\n`;
        });
        
        return context;
    }
    
    deleteMemory(memoryId) {
        const index = this.memories.findIndex(m => m.id === memoryId);
        if (index !== -1) {
            this.memories.splice(index, 1);
            this.saveMemories();
            this.updateMemoryUI();
        }
    }
    
    clearAllMemories() {
        this.memories = [];
        this.saveMemories();
        this.updateMemoryUI();
    }
    
    toggleEnabled() {
        this.enabled = !this.enabled;
        this.saveMemories();
        this.updateMemoryUI();
    }
    
    updateMemoryUI() {
        // Update memory list in settings interface
        const memoryList = document.getElementById('memoryList');
        const memoryToggle = document.getElementById('memoryToggle');
        const clearMemoriesBtn = document.getElementById('clearAllMemoriesBtn');
        
        if (memoryToggle) {
            memoryToggle.checked = this.enabled;
        }
        
        if (memoryList) {
            if (this.memories.length === 0) {
                memoryList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No memories yet</p>';
            } else {
                memoryList.innerHTML = this.memories.map(memory => `
                    <div class="memory-item border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    ${memory.summary}
                                    ${memory.occurrences > 1 ? `<span class="text-xs text-blue-500 ml-2">(mentioned ${memory.occurrences} times)</span>` : ''}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${memory.userProfile}</p>
                                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">${this.formatDate(memory.timestamp)}</p>
                            </div>
                            <button onclick="memoryManager.deleteMemory(${memory.id})" class="ml-2 text-red-500 hover:text-red-700">
                                <i class="fas fa-trash-alt text-sm"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        if (clearMemoriesBtn) {
            clearMemoriesBtn.disabled = this.memories.length === 0;
        }
    }
    
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        
        return date.toLocaleDateString('en-US');
    }

    showStorageError() {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = 'Insufficient storage space, some memories have been automatically cleaned';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// Chat History Manager
class ChatHistoryManager {
    constructor() {
        this.chatHistory = [];
        this.currentChatId = null;
        this.currentMessages = [];
        this.messageCounter = 0;
        this.searchQuery = ''; // New: search query state
        this.syncTimer = null;
        this.pendingSync = false;
        this.loadChatHistory();
    }

    // New: Setup search function
    setupSearchFunction() {
        // Use delayed binding to ensure DOM elements exist
        const bindSearch = () => {
            const searchInput = document.getElementById('chatSearchInput');
            if (searchInput) {
                // Real-time search with debouncing
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.searchQuery = e.target.value.trim().toLowerCase();
                        this.updateChatHistorySidebar();
                    }, 300); // 300ms debouncing
                });

                // Restore display when clearing search
                searchInput.addEventListener('blur', () => {
                    if (!searchInput.value.trim()) {
                        this.searchQuery = '';
                        this.updateChatHistorySidebar();
                    }
                });

                // ESC key to clear search
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        searchInput.value = '';
                        this.searchQuery = '';
                        this.updateChatHistorySidebar();
                        searchInput.blur();
                    }
                });
            } else {
                // If element doesn't exist yet, retry later
                setTimeout(bindSearch, 500);
            }
        };
        
        // Try binding immediately, retry if failed
        bindSearch();
    }

    // New: Search filter function
    filterChatsBySearch(chats) {
        if (!this.searchQuery) return chats;

        return chats.filter(chat => {
            // Search chat title
            if (chat.title && chat.title.toLowerCase().includes(this.searchQuery)) {
                return true;
            }

            // Search message content
            if (chat.messages && chat.messages.length > 0) {
                return chat.messages.some(message => {
                    if (message.content && typeof message.content === 'string') {
                        return message.content.toLowerCase().includes(this.searchQuery);
                    }
                    return false;
                });
            }

            return false;
        });
    }

    // New: Highlight search keywords
    highlightSearchText(text, query) {
        if (!query || !text) return text;
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded text-yellow-900 dark:text-yellow-100">$1</mark>');
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem('jiorkChatHistory');
            if (saved) {
                this.chatHistory = JSON.parse(saved);
                this.chatHistory.forEach((chat, index) => {
                    if (!chat.id) {
                        chat.id = `chat_${Date.now()}_${index}`;
                    }
                });
                this.saveChatHistory();
                this.updateChatHistorySidebar();
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
            this.chatHistory = [];
        }
        
        // Setup search function after loading
        setTimeout(() => {
            this.setupSearchFunction();
        }, 100);
    }

    async loadChatHistory() {
        try {
            const { data: chats } = await supabaseClient
                .from('chat_history')
                .select(`
                    *,
                    chat_messages (*)
                `)
                .eq('user_id', currentUserId)
                .order('updated_at', { ascending: false });
            
            if (chats) {
                this.chatHistory = chats.map(chat => ({
                    id: chat.chat_id,
                    title: chat.title,
                    timestamp: chat.updated_at,
                    messages: chat.chat_messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        thinking: msg.thinking,
                        searchSteps: msg.search_steps,
                        isImage: msg.is_image,
                        imageUrl: msg.image_url,
                        isAudio: msg.is_audio,
                        audioUrl: msg.audio_url,
                        isPersonalityCard: msg.is_personality_card,
                        cardData: msg.card_data,
                        attachments: msg.attachments
                    })),
                    completed: chat.completed
                }));
                
                this.updateChatHistorySidebar();
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    async syncChatToSupabase(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;
        
        try {
            // Save chat record
            const { data: chatData, error: chatError } = await supabaseClient
                .from('chat_history')
                .upsert({
                    user_id: currentUserId,
                    chat_id: chatId,
                    title: chat.title,
                    completed: chat.completed
                }, {
                    onConflict: 'user_id,chat_id'
                });
            
            // Save messages
            for (const msg of chat.messages) {
                await supabaseClient
                    .from('chat_messages')
                    .insert({
                        chat_id: chatData[0].id,
                        role: msg.role,
                        content: msg.content,
                        thinking: msg.thinking,
                        search_steps: msg.searchSteps,
                        is_image: msg.isImage,
                        image_url: msg.imageUrl,
                        is_audio: msg.isAudio,
                        audio_url: msg.audioUrl,
                        is_personality_card: msg.isPersonalityCard,
                        card_data: msg.cardData,
                        attachments: msg.attachments
                    });
            }
        } catch (error) {
            console.error('Error syncing chat:', error);
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem('jiorkChatHistory', JSON.stringify(this.chatHistory));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }

    async createNewChat(firstMessage) {
        if (this.currentChatId === null) {
            const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const title = await this.generateChatTitle(firstMessage);
            
            const newChat = {
                id: chatId,
                title: title,
                timestamp: new Date().toISOString(),
                messages: [],
                completed: false
            };
            
            this.chatHistory.push(newChat);
            this.currentChatId = chatId;
            
            const titleEl = document.getElementById('currentChatTitle');
            if (titleEl) {
                titleEl.textContent = title;
                titleEl.classList.remove('hidden');
            }
            
            this.saveChatHistory();
            this.updateChatHistorySidebar();
        }
    }

    async generateChatTitle(message) {
        try {
            const apiUrl = `${API_CONFIG.deepseek.baseUrl}/chat/completions`;
            
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.deepseek.apiKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { 
                            role: "system", 
                            content: "You are an assistant that helps generate chat titles. Please generate a short English title (no more than 15 words) for the following chat content, only return the title text without quotes or other explanations." 
                        },
                        { role: "user", content: message }
                    ],
                    temperature: 0.5,
                    max_tokens: 25
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // Add data validation
                if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                    const title = data.choices[0].message.content.trim();
                    return title.length > 20 ? title.substring(0, 20) + '...' : title;
                }
            }
        } catch (e) {
            console.error('Error generating title:', e);
        }
        
        return message.length > 15 ? message.substring(0, 15) + '...' : message;
    }

    addMessage(message) {
        // Check if same message already exists
        const isDuplicate = this.currentMessages.some(msg => 
            msg.role === message.role && 
            msg.content === message.content &&
            msg.timestamp && 
            (Date.now() - new Date(msg.timestamp).getTime()) < 1000 // Same message within 1 second is considered duplicate
        );
        
        if (!isDuplicate) {
            message.timestamp = new Date().toISOString();
            this.currentMessages.push(message);
            this.saveMessage(message);
        }
    }

    saveMessage(message) {
        if (this.currentChatId) {
            const chat = this.chatHistory.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.messages = [...this.currentMessages];
                chat.timestamp = new Date().toISOString();
                this.saveChatHistory();
            }
        }
        // Debounced sync to Supabase
        clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncChatToSupabase(this.currentChatId);
        }, 2000);
    }

    startNewChat() {
        // Clear any existing streaming response first
        const streamingResponse = document.getElementById('streamingResponse');
        if (streamingResponse) {
            streamingResponse.remove();
        }
        
        if (this.currentChatId) {
            const chat = this.chatHistory.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.completed = true;
                this.saveChatHistory();
            }
        }
        this.currentChatId = null;
        this.currentMessages = [];
        this.messageCounter = 0;
    }

    loadChat(chatId) {
        // Clear any existing streaming response
        const streamingResponse = document.getElementById('streamingResponse');
        if (streamingResponse) {
            streamingResponse.remove();
        }
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return false;

        this.currentChatId = chatId;
        this.currentMessages = [...chat.messages];
        this.messageCounter = chat.messages.length;

        document.getElementById('initialView').classList.add('hidden');
        document.getElementById('chatView').classList.remove('hidden');
        document.getElementById('bottomInputArea').classList.remove('hidden');
        
        const titleEl = document.getElementById('currentChatTitle');
        titleEl.textContent = chat.title || `Conversation ${this.chatHistory.indexOf(chat) + 1}`;
        titleEl.classList.remove('hidden');
        
        document.getElementById('chatView').innerHTML = '';
        
        chat.messages.forEach(msg => {
            if (msg.role === 'user') {
                this.appendUserMessage(msg.content, true, msg.attachments);
            } else if (msg.role === 'assistant') {
                // Check if it's a personality card
                if (msg.isPersonalityCard && msg.cardData) {
                    // Rebuild personality card
                    const cardData = msg.cardData;
                    const uniqueId = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    
                    // Complete card HTML structure
                    const cardHTML = `
                        <div class="personality-card-container" id="${uniqueId}">
                            <div class="personality-card" id="${uniqueId}_card">
                                <div class="personality-card-header">
                                    <div class="personality-card-title">
                                        <i class="fas fa-id-card mr-2"></i>${cardData.userNickname}'s Personality Card
                                    </div>
                                    <div class="personality-card-subtitle">
                                        <div class="personality-card-level">
                                            <i class="fas fa-star mr-1"></i>Lv.${cardData.userLevel} ${cardData.levelTitle}
                                        </div>
                                        <div class="personality-card-date">
                                            <i class="fas fa-calendar mr-1"></i>${cardData.currentDate}
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="personality-card-left">
                                    <div class="personality-card-section">
                                        <div class="personality-card-label">
                                            <i class="fas fa-tags"></i>Personality Tags
                                        </div>
                                        <div class="personality-card-keywords">
                                            ${cardData.keywords.map(k => `<span class="personality-keyword">${k}</span>`).join('')}
                                        </div>
                                    </div>
                                    
                                    ${cardData.quotes && cardData.quotes.length > 0 ? `
                                    <div class="personality-card-section">
                                        <div class="personality-card-label">
                                            <i class="fas fa-quote-left"></i>Memorable Quotes
                                        </div>
                                        <div class="personality-card-quotes">
                                            ${cardData.quotes.map(q => `<div class="personality-quote">"${q}"</div>`).join('')}
                                        </div>
                                    </div>
                                    ` : ''}
                                    
                                    ${cardData.uniqueness ? `
                                    <div class="personality-card-section">
                                        <div class="personality-card-label">
                                            <i class="fas fa-sparkles"></i>Unique Traits
                                        </div>
                                        <div class="personality-card-description">
                                            ${cardData.uniqueness}
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <div class="personality-card-right">
                                    <div class="personality-card-section">
                                        <div class="personality-card-label">
                                            <i class="fas fa-user-circle"></i>Personality Portrait
                                        </div>
                                        <div class="personality-card-description">
                                            ${cardData.portrait}
                                        </div>
                                    </div>
                                    
                                    ${cardData.feeling ? `
                                    <div class="personality-card-section">
                                        <div class="personality-card-label">
                                            <i class="fas fa-heart"></i>Interaction Feeling
                                        </div>
                                        <div class="personality-card-description">
                                            ${cardData.feeling}
                                        </div>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                ${cardData.blessing ? `
                                <div class="personality-card-footer">
                                    <div class="personality-card-message">
                                        <i class="fas fa-gift mr-2"></i>${cardData.blessing}
                                    </div>
                                </div>
                                ` : ''}
                                
                                <div class="personality-card-controls">
                                    <button class="personality-card-btn" data-card-id="${uniqueId}">
                                        <i class="fas fa-download"></i>Export Image
                                    </button>
                                </div>
                                
                                <div class="export-watermark">
                                    <div class="watermark-logo">JorkAI</div>
                                    <div class="watermark-slogan">The Future is Here</div>
                                    <div class="watermark-url">www.jorkai.cn</div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    const messageContainer = document.createElement('div');
                    messageContainer.className = 'mb-8';
                    messageContainer.innerHTML = cardHTML;
                    document.getElementById('chatView').appendChild(messageContainer);
                    
                    // Add event listener
                    setTimeout(() => {
                        const exportBtn = messageContainer.querySelector('.personality-card-btn');
                        if (exportBtn) {
                            exportBtn.addEventListener('click', function() {
                                const cardId = this.getAttribute('data-card-id');
                                if (window.exportPersonalityCard) {
                                    window.exportPersonalityCard(cardId);
                                } else {
                                    console.error('exportPersonalityCard function not found');
                                }
                            });
                        }
                    }, 100);

                } else {
                    // Handle regular messages
                    this.appendAssistantMessage(
                        msg.content, 
                        msg.thinking, 
                        true,
                        msg.isImage || false,
                        msg.imageUrl || null, 
                        msg.searchSteps || null,
                        msg.isAudio || false,
                        msg.audioUrl || null
                    );
                }
            }
        });

        return true;
    }

    deleteChat(chatId) {
        const index = this.chatHistory.findIndex(c => c.id === chatId);
        if (index !== -1) {
            this.chatHistory.splice(index, 1);
            this.saveChatHistory();
            this.updateChatHistorySidebar();
            
            if (this.currentChatId === chatId) {
                this.startNewChat();
                document.getElementById('initialView').classList.remove('hidden');
                document.getElementById('chatView').classList.add('hidden');
                document.getElementById('bottomInputArea').classList.add('hidden');
                document.getElementById('currentChatTitle').classList.add('hidden');
            }
            
            return true;
        }
        return false;
    }

    // Modified: Update chat history sidebar (includes search functionality)
    updateChatHistorySidebar() {
        const historyContainer = document.getElementById('chatHistory');
        const emptyMessage = document.getElementById('emptyHistoryMessage');
        const searchInput = document.getElementById('chatSearchInput');
        
        // Filter chat records
        const filteredChats = this.filterChatsBySearch(this.chatHistory);
        
        if (this.chatHistory.length === 0) {
            if (emptyMessage) {
                emptyMessage.textContent = 'No chat history yet';
                emptyMessage.classList.remove('hidden');
            }
            if (searchInput) searchInput.style.display = 'none';
            return;
        }

        if (searchInput) searchInput.style.display = 'block';

        if (filteredChats.length === 0 && this.searchQuery) {
            if (emptyMessage) {
                emptyMessage.innerHTML = `<i class="fas fa-search text-gray-400 mr-2"></i>No chats found containing "${this.highlightSearchText(this.searchQuery, this.searchQuery)}"`;
                emptyMessage.classList.remove('hidden');
            }
            // Clear existing chat items
            const existingItems = historyContainer.querySelectorAll('.chat-item');
            existingItems.forEach(item => item.remove());
            return;
        }

        if (emptyMessage) {
            emptyMessage.classList.add('hidden');
        }
        
        const existingItems = historyContainer.querySelectorAll('.chat-item');
        existingItems.forEach(item => item.remove());
        
        filteredChats.slice().reverse().forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            
            // Highlight search results
            const highlightedTitle = this.searchQuery ? 
                this.highlightSearchText(chat.title || 'Unnamed conversation', this.searchQuery) : 
                (chat.title || 'Unnamed conversation');
            
            chatItem.innerHTML = `
                <div class="chat-item-icon">
                    <i class="fas fa-comment-dots"></i>
                </div>
                <div class="chat-item-content">
                    <div class="chat-item-title">${highlightedTitle}</div>
                    <div class="chat-item-time">${this.formatTimestamp(chat.timestamp)}</div>
                    ${this.searchQuery ? '<div class="text-xs text-orange-500 mt-1"><i class="fas fa-search mr-1"></i>Search match</div>' : ''}
                </div>
                <div class="chat-item-actions">
                    <div class="chat-item-delete" data-chat-id="${chat.id}" title="Delete conversation">
                        <i class="fas fa-trash-alt"></i>
                    </div>
                </div>
            `;
            
            chatItem.addEventListener('click', (e) => {
                if (e.target.closest('.chat-item-delete')) {
                    return;
                }
                
                this.loadChat(chat.id);
                toggleSidebar(false);
                
                // Clear search box
                const searchInput = document.getElementById('chatSearchInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.searchQuery = '';
                }
            });
            
            const deleteBtn = chatItem.querySelector('.chat-item-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this conversation?')) {
                    this.deleteChat(chat.id);
                }
            });
            
            historyContainer.appendChild(chatItem);
        });
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    // 其余方法保持不变...（appendUserMessage, appendAssistantMessage等方法代码太长，这里省略，保持原样即可）
    async appendUserMessage(message, dontSave = false, attachments = null) {
        this.messageCounter++;
        
        const chatView = document.getElementById('chatView');
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'user-message-container';
        
        const messageInner = document.createElement('div');
        messageInner.className = 'flex items-center';
        
        const userBadge = document.createElement('div');
        userBadge.className = 'mr-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-1 px-3 rounded-full font-medium text-sm';
        userBadge.textContent = '用户';
        
        const messageText = document.createElement('div');
        messageText.className = 'text-lg';
        messageText.textContent = message;
        
        messageInner.appendChild(userBadge);
        messageInner.appendChild(messageText);
        messageContainer.appendChild(messageInner);
        
        chatView.appendChild(messageContainer);
        
        if (attachments && attachments.length > 0) {
            const attachmentsContainer = document.createElement('div');
            attachmentsContainer.className = 'ml-12 mb-4 flex flex-wrap gap-2';
            
            attachments.forEach(file => {
                const filePreview = document.createElement('div');
                filePreview.className = 'file-preview';
                
                const fileIcon = this.getFileIcon(file.type);
                
                if (file.type.startsWith('image/')) {
                    let imageSrc = '';
                    if (file.data) {
                        imageSrc = `data:${file.type};base64,${file.data}`;
                    } else if (file instanceof File) {
                        imageSrc = URL.createObjectURL(file);
                    }
                    
                    filePreview.innerHTML = `
                        <img src="${imageSrc}" class="file-thumbnail" alt="Preview">
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                    `;
                } else {
                    filePreview.innerHTML = `
                        <div class="file-icon">
                            <i class="${fileIcon}"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                    `;
                }
                
                attachmentsContainer.appendChild(filePreview);
            });
            
            chatView.appendChild(attachmentsContainer);
        }
        
        if (!dontSave) {
            if (this.currentChatId === null) {
                await this.createNewChat(message);
            }
            
            const messageObj = {
                role: 'user',
                content: message
            };
            
            if (attachments && attachments.length > 0) {
                messageObj.attachments = [];
                
                for (const file of attachments) {
                    const attachmentObj = {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    };
                    
                    if (file.type.startsWith('image/')) {
                        try {
                            const base64Data = await this.fileToBase64(file);
                            attachmentObj.data = base64Data.split(',')[1];
                        } catch (error) {
                            console.error('Error converting file to base64:', error);
                        }
                    }
                    
                    messageObj.attachments.push(attachmentObj);
                }
            }
            
            this.addMessage(messageObj);
        }
        
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    appendAssistantMessage(message, thinking = null, dontSave = false, isImage = false, imageUrl = null, searchSteps = null, isAudio = false, audioUrl = null) {
        // 检查是否是人格卡片
        if (window.isPersonalityCard) {
            window.isPersonalityCard = false;
            
            // 移除加载占位
            const loadingEl = document.getElementById('personalityCardLoading');
            if (loadingEl) {
                loadingEl.remove();
            }
            
            // 解析返回的内容
            const sections = message.split(/【|】/).filter(s => s.trim());
            let portrait = '', uniqueness = '', feeling = '', blessing = '';
            
            for (let i = 0; i < sections.length; i++) {
                if (sections[i].includes('人格画像')) portrait = sections[i + 1] || '';
                if (sections[i].includes('独特之处')) uniqueness = sections[i + 1] || '';
                if (sections[i].includes('相处感受')) feeling = sections[i + 1] || '';
                if (sections[i].includes('专属寄语')) blessing = sections[i + 1] || '';
            }
            
            // 如果没有正确解析，使用原始消息
            if (!portrait) {
                portrait = message;
            }
            
            // 获取用户信息
            const userNickname = localStorage.getItem('jiorkUserNickname') || '神秘访客';
            const userLevel = levelSystem ? levelSystem.levelData.level : 1;
            const levelTitle = levelSystem ? levelSystem.getLevelTitle(userLevel) : '新手上路';
            
            // 获取关键词和金句
            let keywords = [];
            let quotes = [];
            
            if (memoryManager && memoryManager.memories.length > 0) {
                const keywordSet = new Set();
                memoryManager.memories.forEach(memory => {
                    if (memory.userProfile) {
                        const words = memory.userProfile.split(/[，、,\s]+/)
                            .filter(w => w.length > 1 && w.length < 10);
                        words.forEach(w => keywordSet.add(w));
                    }
                });
                keywords = Array.from(keywordSet).slice(0, 8);
                
                quotes = memoryManager.memories
                    .filter(m => m.isQuote || (m.message && m.message.length > 20 && m.message.length < 100))
                    .map(m => m.quoteValue || m.message)
                    .slice(0, 3);
            }
            
            if (keywords.length === 0) {
                keywords = ['初来乍到', '充满好奇', '探索者', '学习者', '潜力无限'];
            }
            
            const currentDate = new Date().toLocaleDateString('zh-CN');
            const uniqueId = 'card_' + Date.now();
            
            // 创建卡片HTML（删除了切换按钮和文本模式）
            const cardHTML = `
                <div class="personality-card-container" id="${uniqueId}">
                    <div class="personality-card" id="${uniqueId}_card">
                        <div class="personality-card-header">
                            <div class="personality-card-title">
                                <i class="fas fa-id-card mr-2"></i>${userNickname} 的人格卡
                            </div>
                            <div class="personality-card-subtitle">
                                <div class="personality-card-level">
                                    <i class="fas fa-star mr-1"></i>Lv.${userLevel} ${levelTitle}
                                </div>
                                <div class="personality-card-date">
                                    <i class="fas fa-calendar mr-1"></i>${currentDate}
                                </div>
                            </div>
                        </div>
                        
                        <div class="personality-card-left">
                            <div class="personality-card-section">
                                <div class="personality-card-label">
                                    <i class="fas fa-tags"></i>性格标签
                                </div>
                                <div class="personality-card-keywords">
                                    ${keywords.map(k => `<span class="personality-keyword">${k}</span>`).join('')}
                                </div>
                            </div>
                            
                            ${quotes.length > 0 ? `
                            <div class="personality-card-section">
                                <div class="personality-card-label">
                                    <i class="fas fa-quote-left"></i>金句摘录
                                </div>
                                <div class="personality-card-quotes">
                                    ${quotes.map(q => `<div class="personality-quote">"${q}"</div>`).join('')}
                                </div>
                            </div>
                            ` : ''}
                            
                            ${uniqueness ? `
                            <div class="personality-card-section">
                                <div class="personality-card-label">
                                    <i class="fas fa-sparkles"></i>独特之处
                                </div>
                                <div class="personality-card-description">
                                    ${uniqueness}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="personality-card-right">
                            <div class="personality-card-section">
                                <div class="personality-card-label">
                                    <i class="fas fa-user-circle"></i>人格画像
                                </div>
                                <div class="personality-card-description">
                                    ${portrait}
                                </div>
                            </div>
                            
                            ${feeling ? `
                            <div class="personality-card-section">
                                <div class="personality-card-label">
                                    <i class="fas fa-heart"></i>相处感受
                                </div>
                                <div class="personality-card-description">
                                    ${feeling}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        ${blessing ? `
                        <div class="personality-card-footer">
                            <div class="personality-card-message">
                                <i class="fas fa-gift mr-2"></i>${blessing}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="personality-card-controls">
                            <button class="personality-card-btn export-card-btn" data-card-id="${uniqueId}">
                                <i class="fas fa-download"></i>导出图片
                            </button>
                        </div>
                        
                        <div class="export-watermark">
                            <div class="watermark-logo">JorkAI</div>
                            <div class="watermark-slogan">未来已来</div>
                            <div class="watermark-url">www.jorkai.cn</div>
                        </div>
                    </div>
                </div>
            `;
            
            const chatView = document.getElementById('chatView');
            const messageContainer = document.createElement('div');
            messageContainer.className = 'mb-8';
            messageContainer.innerHTML = cardHTML;
            
            chatView.appendChild(messageContainer);
            
            // 添加事件监听器
            setTimeout(() => {
                const exportBtn = messageContainer.querySelector('.export-card-btn');
                if (exportBtn) {
                    exportBtn.addEventListener('click', function() {
                        const cardId = this.getAttribute('data-card-id');
                        if (window.exportPersonalityCard) {
                            window.exportPersonalityCard(cardId);
                        } else {
                            console.error('exportPersonalityCard function not found');
                        }
                    });
                }
            }, 100);
            
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // 保存到历史
            if (!dontSave) {
                const messageObj = {
                    role: 'assistant',
                    content: message,
                    isPersonalityCard: true,
                    cardData: {
                        userNickname,
                        userLevel,
                        levelTitle,
                        keywords,
                        quotes,
                        portrait,
                        uniqueness,
                        feeling,
                        blessing,
                        currentDate
                    }
                };
                this.addMessage(messageObj);
            }
            
            return;
        }
        
        // 以下是原有代码...
        
        const chatView = document.getElementById('chatView');
        const messageContainer = document.createElement('div');
        messageContainer.className = 'mb-8';
        
        // 显示搜索过程（如果有）- 深度搜索模型或有搜索内容时显示
        if (searchSteps && searchSteps.length > 0 && (globalSelectedModel === 'Jork-Epist-4' || searchSteps.some(step => step.includes('搜索') || step.includes('search')))) {
            const searchContainer = document.createElement('div');
            searchContainer.className = 'epist-search-container';
            
            const searchHeader = document.createElement('div');
            searchHeader.className = 'epist-search-header';
            searchHeader.innerHTML = '<i class="fas fa-magnifying-glass epist-search-icon"></i>深度搜索分析过程';
            searchContainer.appendChild(searchHeader);
            
            const searchContent = document.createElement('div');
            searchContent.className = 'epist-search-content';
            searchContent.id = `search-content-${Date.now()}`;
            
            // 所有搜索内容在一个大框里
            const searchText = Array.isArray(searchSteps) ? searchSteps.join('\n\n') : searchSteps.toString();
            searchContent.textContent = searchText;
            
            searchContainer.appendChild(searchContent);
            
            // 默认折叠长内容
            if (searchText.length > 500) {
                searchContent.classList.add('epist-search-collapsed');
            }
            
            // 折叠按钮
            const toggleButton = document.createElement('button');
            toggleButton.className = 'epist-search-toggle';
            toggleButton.innerHTML = searchContent.classList.contains('epist-search-collapsed') 
                ? '<i class="fas fa-chevron-down"></i>展开搜索过程'
                : '<i class="fas fa-chevron-up"></i>收起搜索过程';
            
            toggleButton.addEventListener('click', function() {
                const icon = this.querySelector('i');
                if (searchContent.classList.contains('epist-search-collapsed')) {
                    searchContent.classList.remove('epist-search-collapsed');
                    icon.className = 'fas fa-chevron-up';
                    this.innerHTML = '<i class="fas fa-chevron-up"></i>收起搜索过程';
                } else {
                    searchContent.classList.add('epist-search-collapsed');
                    icon.className = 'fas fa-chevron-down';
                    this.innerHTML = '<i class="fas fa-chevron-down"></i>展开搜索过程';
                }
            });
            
            searchContainer.appendChild(toggleButton);
            messageContainer.appendChild(searchContainer);
        }
        
        // 显示图片
        if (isImage && imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'mb-4';
            
            const generatedImage = document.createElement('img');
            generatedImage.src = imageUrl;
            generatedImage.className = 'generated-image';
            generatedImage.alt = 'Generated Image';
            
            generatedImage.addEventListener('click', () => {
                this.openImageViewer(imageUrl, false);
            });
            
            imageContainer.appendChild(generatedImage);
            messageContainer.appendChild(imageContainer);
        }

        // 在显示图片的代码后添加音频显示
        if (isAudio && audioUrl) {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'mb-4';
            
            const audioPlayer = document.createElement('audio');
            audioPlayer.src = audioUrl;
            audioPlayer.controls = true;
            audioPlayer.className = 'w-full max-w-md mx-auto';
            
            audioContainer.appendChild(audioPlayer);
            messageContainer.appendChild(audioContainer);
            
            // 添加下载按钮
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'mt-2 px-4 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors';
            downloadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>下载音乐';
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = audioUrl;
                link.download = 'generated-music.mp3';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
            
            audioContainer.appendChild(downloadBtn);
        }

        // 在保存消息对象时添加音频信息
        if (!dontSave) {
            const messageObj = {
                role: 'assistant',
                content: message,
                thinking: thinking,
                searchSteps: searchSteps,
                isImage: isImage,
                imageUrl: imageUrl,
                isAudio: isAudio,
                audioUrl: audioUrl
            };
            
            this.addMessage(messageObj);
        }
        
        // 显示文本内容
        if ((!isImage) || message) {
            const markdownOutput = marked.parse(message);
            
            const messageContent = document.createElement('div');
            messageContent.className = 'markdown-content';
            messageContent.innerHTML = markdownOutput;
            
            this.processCanvasTags(messageContent);
            
            const codeBlocks = messageContent.querySelectorAll('pre');
            codeBlocks.forEach(block => {
                block.className = 'code-block relative';
                
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button text-xs';
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyButton.title = '复制代码';
                
                copyButton.addEventListener('click', () => {
                    const code = block.querySelector('code')?.textContent || '';
                    navigator.clipboard.writeText(code).then(() => {
                        copyButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    });
                });
                
                block.appendChild(copyButton);
            });
            // 应用代码高亮
            if (typeof Prism !== 'undefined') {
               Prism.highlightAllUnder(messageContent);
            }
            
            messageContainer.appendChild(messageContent);
        }
        
        // 添加控制按钮
        const logoAndControls = document.createElement('div');
        logoAndControls.className = 'flex justify-between items-center mb-4';
        
        const disclaimer = document.createElement('div');
        disclaimer.className = 'text-sm text-gray-500';
        disclaimer.textContent = isImage ? 'Aria可能会犯错，请核实媒体内容。' : 'TyloAI可能会犯错，请核实回复内容。';
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'flex items-center space-x-2';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300';
        copyButton.innerHTML = '<i class="far fa-clipboard"></i>';
        
        const thumbsUpButton = document.createElement('button');
        thumbsUpButton.className = 'p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300';
        thumbsUpButton.innerHTML = '<i class="far fa-thumbs-up"></i>';
        
        const thumbsDownButton = document.createElement('button');
        thumbsDownButton.className = 'p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300';
        thumbsDownButton.innerHTML = '<i class="far fa-thumbs-down"></i>';
        
        const regenerateButton = document.createElement('button');
        regenerateButton.className = 'p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300';
        regenerateButton.innerHTML = '<i class="fas fa-redo"></i>';
        
        controlsContainer.appendChild(copyButton);
        controlsContainer.appendChild(thumbsUpButton);
        controlsContainer.appendChild(thumbsDownButton);
        controlsContainer.appendChild(regenerateButton);
        
        logoAndControls.appendChild(disclaimer);
        logoAndControls.appendChild(controlsContainer);
        
        chatView.appendChild(messageContainer);
        //chatView.appendChild(logoAndControls);
        
        if (!dontSave) {
            chatView.appendChild(logoAndControls);  // 添加这行
            const messageObj = {
                role: 'assistant',
                content: message,
                thinking: thinking,
                searchSteps: searchSteps,  // 新增
                isImage: isImage,
                imageUrl: imageUrl
            };
            
            this.addMessage(messageObj);
        }
        
        copyButton.addEventListener('click', () => {
            const textToCopy = (isImage && imageUrl) ? imageUrl : message;
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="far fa-clipboard"></i>';
                }, 2000);
            });
        });
        
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    openImageViewer(mediaUrl, isVideo = false) {
        const imageViewerContainer = document.getElementById('imageViewerContainer');
        const imageViewerImage = document.getElementById('imageViewerImage');
        const imageViewerVideo = document.getElementById('imageViewerVideo');
        
        if (isVideo) {
            imageViewerVideo.src = mediaUrl;
            imageViewerVideo.style.display = 'block';
            imageViewerImage.style.display = 'none';
        } else {
            imageViewerImage.src = mediaUrl;
            imageViewerImage.style.display = 'block';
            imageViewerVideo.style.display = 'none';
        }
        
        imageViewerContainer.classList.add('active');
    }

    processCanvasTags(contentEl) {
    const canvasMatches = contentEl.innerHTML.match(/<canvas>([\s\S]*?)<\/canvas>/g);
    
    if (canvasMatches) {
        let newHTML = contentEl.innerHTML;
        canvasMatches.forEach((match, index) => {
            const canvasContent = match.replace(/<\/?canvas>/g, '');
            
            const canvasPreview = document.createElement('div');
            canvasPreview.className = 'canvas-preview-container bg-gray-100 dark:bg-gray-800 rounded-lg p-4 my-4 border border-gray-200 dark:border-gray-700';
            
            canvasPreview.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-medium text-gray-700 dark:text-gray-300">
                        <i class="fas fa-code mr-2"></i>可运行代码 #${index + 1}
                    </h4>
                    <div class="flex space-x-2">
                        <button class="canvas-view-btn bg-orange-200 text-orange-600 px-3 py-1 rounded text-sm hover:bg-orange-300 transition-colors">
                            <i class="fas fa-eye mr-1"></i>预览效果
                        </button>
                        <button class="canvas-code-btn bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors">
                            <i class="fas fa-code mr-1"></i>查看源码
                        </button>
                        <button class="canvas-open-btn bg-green-100 text-green-600 px-3 py-1 rounded text-sm hover:bg-green-200 transition-colors">
                            <i class="fas fa-external-link-alt mr-1"></i>在画布中打开
                        </button>
                    </div>
                </div>
                <div class="canvas-iframe-container hidden">
                    <iframe class="w-full h-96 border border-gray-300 dark:border-gray-600 rounded" 
                            sandbox="allow-scripts allow-same-origin" 
                            srcdoc="${canvasContent.replace(/"/g, '&quot;')}">
                    </iframe>
                </div>
                <div class="canvas-source-container">
                    <pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto text-sm"><code>${canvasContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                </div>
            `;
            
            // 替换时使用占位符
            const placeholder = `<div id="canvas-placeholder-${index}"></div>`;
            newHTML = newHTML.replace(match, placeholder);
        });
        
        // 一次性更新HTML
        contentEl.innerHTML = newHTML;
        
        // 然后替换占位符为实际的Canvas预览元素
        canvasMatches.forEach((match, index) => {
            const placeholder = contentEl.querySelector(`#canvas-placeholder-${index}`);
            if (placeholder) {
                const canvasContent = match.replace(/<\/?canvas>/g, '');
                // 重新创建预览元素并插入
                const canvasPreview = this.createCanvasPreview(canvasContent, index);
                placeholder.replaceWith(canvasPreview);
            }
        });
    }
}

    openCodeInCanvas(code) {
        const canvasContainer = document.getElementById('canvasContainer');
        const canvasIframe = document.getElementById('canvasIframe');
        const canvasEditor = document.getElementById('canvasEditor');
        
        currentCanvasCode = code;
        canvasEditor.style.display = 'none';
        canvasIframe.style.height = '100%';
        canvasEditor.textContent = code;
        
        this.updateCanvasFrame(code);
        canvasContainer.classList.add('active');
        canvasIsActive = true;
    }

    updateCanvasFrame(code) {
        const canvasIframe = document.getElementById('canvasIframe');
        const frameDoc = canvasIframe.contentDocument || canvasIframe.contentWindow.document;
        
        frameDoc.open();
        frameDoc.write(code);
        frameDoc.close();
    }

    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return 'far fa-file-image';
        else if (fileType.startsWith('video/')) return 'far fa-file-video';
        else if (fileType.startsWith('audio/')) return 'far fa-file-audio';
        else if (fileType.startsWith('text/')) return 'far fa-file-alt';
        else if (fileType.includes('pdf')) return 'far fa-file-pdf';
        else return 'far fa-file';
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
}



        // Button State Manager
class ButtonStateManager {
    constructor() {
        this.originalButtons = new Map();
    }

    setStopState(buttonId, restoreCallback) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (!this.originalButtons.has(buttonId)) {
            this.originalButtons.set(buttonId, {
                innerHTML: button.innerHTML,
                onclick: button.onclick,
                className: button.className
            });
        }

        button.innerHTML = '<i class="fas fa-stop"></i>';
        button.classList.add('stop-generation');
        button.onclick = () => {
            requestManager.abortAllRequests();
            this.restoreButton(buttonId);
            if (restoreCallback) restoreCallback();
        };
    }

    restoreButton(buttonId) {
        const button = document.getElementById(buttonId);
        const originalState = this.originalButtons.get(buttonId);
        
        if (button && originalState) {
            button.innerHTML = originalState.innerHTML;
            button.onclick = originalState.onclick;
            button.className = originalState.className;
            this.originalButtons.delete(buttonId);
        }
    }

    restoreAllButtons() {
        for (const buttonId of this.originalButtons.keys()) {
            this.restoreButton(buttonId);
        }
    }
}

// Beginner Guide System
class GuideSystem {
    constructor() {
        this.guideKey = 'jiorkGuideCompleted';
        this.currentStep = 0;
        this.steps = [
            {
                type: 'welcome',
                title: 'Welcome to TyloAI!',
                content: 'I am your AI assistant, I can help you with writing, programming, learning, creating images, and more. Let me show you how to use it quickly!',
                target: null
            },
            {
                type: 'tooltip',
                title: 'Input Box',
                content: 'Enter your questions or requests here, and I will answer immediately. Supports text, images, and other input methods.',
                target: '#userInput',
                position: 'top'
            },
            {
                type: 'tooltip', 
                title: 'Points System',
                content: 'Each conversation consumes 50 points, automatically resets to 3000 points daily. Pro users enjoy unlimited points!',
                target: '#quotaContainer',
                position: 'bottom'
            },
            {
                type: 'tooltip',
                title: 'Personal Center',
                content: 'Click here to view your level, AI memories, check-in for experience, etc. The higher the level, the more features unlocked!',
                target: '#userInfoPanel',
                position: 'top'
            },
            {
                type: 'tooltip',
                title: 'Upgrade to Pro',
                content: 'After upgrading to Pro, enjoy unlimited points, max level privileges, access to all models, and many more benefits!',
                target: '#planStatus',
                position: 'bottom'
            }
        ];
        this.overlay = null;
        this.tooltip = null;
        this.isActive = false;
    }
    
    // Check if guide needs to be shown
    shouldShowGuide() {
        const completed = localStorage.getItem(this.guideKey);
        return !completed;
    }
    
    // Start guide
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentStep = 0;
        
        // Ensure on initial interface
        document.getElementById('initialView').classList.remove('hidden');
        document.getElementById('chatView').classList.add('hidden');
        document.getElementById('bottomInputArea').classList.add('hidden');
        
        // Create overlay
        this.createOverlay();
        
        // Show first step
        this.showStep(0);
    }
    
    // Create overlay
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'guide-overlay';
        document.body.appendChild(this.overlay);
    }
    
    // Show step
    showStep(stepIndex) {
        if (stepIndex >= this.steps.length) {
            this.complete();
            return;
        }
        
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];
        
        // Clear previous tooltip
        this.clearTooltip();
        
        if (step.type === 'welcome') {
            this.showWelcomeModal(step);
        } else {
            this.showTooltip(step);
        }
    }
    
    // Show welcome modal
    showWelcomeModal(step) {
        const modal = document.createElement('div');
        modal.className = 'guide-welcome-modal';
        modal.innerHTML = `
            <div class="guide-welcome-icon">
                <i class="fas fa-rocket"></i>
            </div>
            <h2 class="guide-welcome-title">${step.title}</h2>
            <p class="guide-welcome-subtitle">${step.content}</p>
            <div class="guide-footer">
                <div class="guide-steps">
                    ${this.steps.map((_, i) => 
                        `<div class="guide-step-dot ${i === this.currentStep ? 'active' : ''}"></div>`
                    ).join('')}
                </div>
                <div class="guide-buttons">
                    <button class="guide-btn guide-btn-skip" onclick="guideSystem.skip()">
                        Skip Guide
                    </button>
                    <button class="guide-btn guide-btn-next" onclick="guideSystem.next()">
                        Start Exploring <i class="fas fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.tooltip = modal;
    }
    
    // Show tooltip
    showTooltip(step) {
        const target = document.querySelector(step.target);
        if (!target) {
            this.next();
            return;
        }
        
        // Highlight target element
        target.classList.add('guide-highlight', 'guide-pulse');
        
        // Scroll to target element
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = `guide-tooltip ${step.position}`;
        
        const isLastStep = this.currentStep === this.steps.length - 1;
        
        tooltip.innerHTML = `
            <h3 class="guide-title">${step.title}</h3>
            <p class="guide-content">${step.content}</p>
            <div class="guide-footer">
                <div class="guide-steps">
                    ${this.steps.map((_, i) => 
                        `<div class="guide-step-dot ${i === this.currentStep ? 'active' : ''}"></div>`
                    ).join('')}
                </div>
                <div class="guide-buttons">
                    <button class="guide-btn guide-btn-skip" onclick="guideSystem.skip()">
                        Skip
                    </button>
                    <button class="guide-btn ${isLastStep ? 'guide-btn-complete' : 'guide-btn-next'}" 
                            onclick="guideSystem.next()">
                        ${isLastStep ? 'Complete Guide' : 'Next'} 
                        <i class="fas fa-${isLastStep ? 'check' : 'arrow-right'} ml-1"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(tooltip);
        this.tooltip = tooltip;
        
        // Position tooltip
        this.positionTooltip(tooltip, target, step.position);
    }
    
    // Position tooltip
    positionTooltip(tooltip, target, position) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch(position) {
            case 'top':
                top = targetRect.top - tooltipRect.height - 20;
                left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = targetRect.bottom + 20;
                left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                left = targetRect.left - tooltipRect.width - 20;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
                left = targetRect.right + 20;
                break;
        }
        
        // Ensure tooltip is within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }
    
    // Clear tooltip
    clearTooltip() {
        // Remove highlight
        document.querySelectorAll('.guide-highlight').forEach(el => {
            el.classList.remove('guide-highlight', 'guide-pulse');
        });
        
        // Remove tooltip
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
    }
    
    // Next step
    next() {
        this.showStep(this.currentStep + 1);
    }
    
    // Skip guide
    skip() {
        if (confirm('Are you sure you want to skip the beginner guide? You can re-enable it in settings anytime.')) {
            this.complete(false);
        }
    }
    
    // Complete guide
    complete(giveReward = true) {
        // Clean up
        this.clearTooltip();
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Mark as completed
        localStorage.setItem(this.guideKey, 'true');
        this.isActive = false;
        
        // Give reward
        if (giveReward && levelSystem) {
            levelSystem.addExp(100, 'Complete Beginner Guide');
            
            // Show completion notification
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center';
            notification.innerHTML = `
                <i class="fas fa-trophy mr-3 text-yellow-300"></i>
                <div>
                    <div class="font-bold">Congratulations on completing the guide!</div>
                    <div class="text-sm">Earned 100 experience points</div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }
    }
    
    // Reset guide (for settings)
    reset() {
        localStorage.removeItem(this.guideKey);
        
        // Close user settings modal
        const userModal = document.getElementById('userInfoModal');
        if (userModal) {
            userModal.classList.add('hidden');
        }
        
        // Return to initial interface
        document.getElementById('initialView').classList.remove('hidden');
        document.getElementById('chatView').classList.add('hidden');
        document.getElementById('bottomInputArea').classList.add('hidden');
        
        // Start guide
        setTimeout(() => {
            this.start();
        }, 300);
    }
}

// Create global guide system instance
let guideSystem;

// AI成就勋章系统
class AchievementSystem {
    constructor() {
        this.achievementKey = 'jiorkAchievements';
        this.achievements = {
            firstQuestion: {
            name: 'First Steps',
            description: 'Complete your first question',
            icon: '🎯'
        },
        dailyStreak3: {
            name: 'Persistent',
            description: 'Check in for 3 consecutive days',
            icon: '📅'
        },
        questions50: {
            name: 'AI Questioner',
            description: 'Ask 50 questions in total',
            icon: '💬'
        },
        feedback10: {
            name: 'Feedback Lover',
            description: 'Give feedback 10 times',
            icon: '👍'
        },
        level5: {
            name: 'Growth Expert',
            description: 'Reach Level 5',
            icon: '⭐'
        },
        explorer: {
            name: 'Explorer',
            description: 'Use 3 different models',
            icon: '🔍'
        },
        deepThinker: {
            name: 'Deep Thinker',
            description: 'AI generates a response over 1000 words',
            icon: '🧠'
        },
        easterEggHunter: {
            name: 'Easter Egg Hunter',
            description: 'Trigger hidden voice package',
            icon: '🥚'
        },
        publicWelfare: {
            name: 'Charity Guardian',
            description: 'Support charity activities',
            icon: '❤️'
        },
        inviter: {
            name: 'Mentor',
            description: 'Successfully invite 1 new user',
            icon: '🎓'
        }
    };
        
        this.loadAchievements();
        this.initTimeCheckers();
        this.questionCount = parseInt(localStorage.getItem('jiorkQuestionCount') || '0');
        this.streakDays = parseInt(localStorage.getItem('jiorkStreakDays') || '0');
        this.lastCheckIn = localStorage.getItem('jiorkLastCheckIn');
    }
    
loadAchievements() {
    try {
        const saved = localStorage.getItem(this.achievementKey);
        if (saved) {
            const savedData = JSON.parse(saved);
            // 合并保存的数据
            Object.keys(savedData).forEach(key => {
                if (this.achievements[key]) {
                    Object.assign(this.achievements[key], savedData[key]);
                    
                    // 特殊处理 explorer 的 progress，确保它是 Set
                    if (key === 'explorer' && savedData[key].progress) {
                        // 将数组转换回 Set
                        if (Array.isArray(savedData[key].progress)) {
                            this.achievements[key].progress = new Set(savedData[key].progress);
                        } else {
                            this.achievements[key].progress = new Set();
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error loading achievements:', e);
    }
}

async loadAchievements() {
    try {
        const { data: achievements } = await supabaseClient
            .from('achievements')
            .select('*')
            .eq('user_id', currentUserId);
        
        if (achievements) {
            achievements.forEach(a => {
                if (this.achievements[a.achievement_id]) {
                    this.achievements[a.achievement_id].unlocked = a.unlocked;
                    this.achievements[a.achievement_id].unlockedAt = a.unlocked_at;
                    this.achievements[a.achievement_id].progress = a.progress;
                    if (a.data) {
                        Object.assign(this.achievements[a.achievement_id], a.data);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

async syncAchievementToSupabase(achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement) return;
    
    try {
        await supabaseClient
            .from('achievements')
            .upsert({
                user_id: currentUserId,
                achievement_id: achievementId,
                unlocked: achievement.unlocked,
                unlocked_at: achievement.unlockedAt,
                progress: achievement.progress,
                data: {
                    name: achievement.name,
                    description: achievement.description,
                    icon: achievement.icon
                }
            }, {
                onConflict: 'user_id,achievement_id'
            });
    } catch (error) {
        console.error('Error syncing achievement:', error);
    }
}
    
saveAchievements() {
    try {
        // 创建一个副本用于保存
        const dataToSave = {};
        Object.keys(this.achievements).forEach(key => {
            dataToSave[key] = { ...this.achievements[key] };
            
            // 特殊处理 explorer 的 progress Set
            if (key === 'explorer' && this.achievements[key].progress instanceof Set) {
                dataToSave[key].progress = Array.from(this.achievements[key].progress);
            }
        });
        
        localStorage.setItem(this.achievementKey, JSON.stringify(dataToSave));
    } catch (e) {
        console.error('Error saving achievements:', e);
    }
    // 同步所有成就到 Supabase
    Object.keys(this.achievements).forEach(key => {
        this.syncAchievementToSupabase(key);
    });
}
    
    // 初始化时间检查器
    initTimeCheckers() {
        // 检查特殊时间
        const checkSpecialTime = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            
            // 早起鸟儿 - 5:20
            if (hours === 5 && minutes === 20) {
                this.unlock('earlyBird');
            }
            
            // 夜猫子 - 3:00-4:00
            if (hours === 3) {
                this.unlock('nightOwl');
            }
        };
        
        // 每分钟检查一次
        setInterval(checkSpecialTime, 60000);
        checkSpecialTime(); // 立即检查一次
    }
    
    // 检查成就
    check(type, data = {}) {
        switch(type) {
            case 'firstQuestion':
                if (!this.achievements.firstQuestion.unlocked) {
                    this.unlock('firstQuestion');
                }
                break;
                
            case 'question':
                this.questionCount++;
                localStorage.setItem('jiorkQuestionCount', this.questionCount.toString());
                
                // 检查提问数量成就
                if (!this.achievements.questions50.unlocked) {
                    this.achievements.questions50.progress = this.questionCount;
                    if (this.questionCount >= 50) {
                        this.unlock('questions50');
                    }
                }
                
                // 检查幸运数字
                if (this.questionCount === 666 || this.questionCount === 888) {
                    this.unlock('luckyNumber');
                }
                break;
                
            case 'dailyCheckIn':
                const today = new Date().toDateString();
                if (this.lastCheckIn !== today) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    
                    if (this.lastCheckIn === yesterday.toDateString()) {
                        this.streakDays++;
                    } else {
                        this.streakDays = 1;
                    }
                    
                    this.lastCheckIn = today;
                    localStorage.setItem('jiorkStreakDays', this.streakDays.toString());
                    localStorage.setItem('jiorkLastCheckIn', today);
                    
                    if (!this.achievements.dailyStreak3.unlocked) {
                        this.achievements.dailyStreak3.progress = this.streakDays;
                        if (this.streakDays >= 3) {
                            this.unlock('dailyStreak3');
                        }
                    }
                }
                break;
                
            case 'level':
                if (data.level >= 5 && !this.achievements.level5.unlocked) {
                    this.unlock('level5');
                }
                break;
                
                case 'modelUsed':
                if (!this.achievements.explorer.unlocked) {
                    // 确保 progress 是 Set
                    if (!(this.achievements.explorer.progress instanceof Set)) {
                        this.achievements.explorer.progress = new Set();
                    }
                    
                    this.achievements.explorer.progress.add(data.model);
                    if (this.achievements.explorer.progress.size >= 3) {
                        this.unlock('explorer');
                    }
                }
                break;
                
            case 'responseLength':
                if (data.length > 1000 && !this.achievements.deepThinker.unlocked) {
                    this.unlock('deepThinker');
                }
                break;
                
            case 'hiddenFeature':
                if (!this.achievements.easterEggHunter.unlocked) {
                    this.unlock('easterEggHunter');
                }
                break;
                
            case 'secretPhrase':
                if (data.message && data.message.includes('稀有勋章')) {
                    this.unlock('secretPhrase');
                    this.showHint('🎊 恭喜发现隐藏暗号！');
                }
                break;
                
            case 'invite':
                if (!this.achievements.inviter.unlocked) {
                    this.achievements.inviter.progress = (this.achievements.inviter.progress || 0) + 1;
                    if (this.achievements.inviter.progress >= 1) {
                        this.unlock('inviter');
                    }
                }
                break;
        }
        
        this.saveAchievements();
    }
    


        // Unlock achievement
unlock(achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement || achievement.unlocked) return;
    
    achievement.unlocked = true;
    achievement.unlockedAt = new Date().toISOString();
    this.saveAchievements();
    
    // Show unlock animation
    this.showUnlockPopup(achievement);
    
    // Give reward
    if (levelSystem) {
        levelSystem.addExp(50, `Unlocked achievement "${achievement.name}"`);
    }
}

// Show unlock popup
showUnlockPopup(achievement) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'guide-overlay';
    document.body.appendChild(overlay);
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'achievement-unlock-popup';
    popup.innerHTML = `
        <div class="achievement-unlock-icon">${achievement.icon}</div>
        <div class="achievement-unlock-title">🎉 Achievement Unlocked!</div>
        <div class="achievement-unlock-name">"${achievement.name}"</div>
        <div class="achievement-unlock-description">${achievement.description}</div>
        <div class="achievement-unlock-actions">
            <button class="achievement-unlock-btn achievement-unlock-share" onclick="achievementSystem.shareAchievement('${achievement.id}')">
                <i class="fas fa-share-alt mr-2"></i>Share Achievement
            </button>
            <button class="achievement-unlock-btn achievement-unlock-close" onclick="achievementSystem.closeUnlockPopup()">
                View Achievement Wall
            </button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Play sound effect (if needed)
    this.playUnlockSound();
    
    // Auto close
    setTimeout(() => {
        if (popup.parentNode) {
            this.closeUnlockPopup();
        }
    }, 5000);
}

// Close unlock popup
closeUnlockPopup() {
    const popup = document.querySelector('.achievement-unlock-popup');
    const overlay = document.querySelector('.guide-overlay');
    
    if (popup) {
        popup.style.animation = 'achievementUnlockPop 0.3s ease reverse';
        setTimeout(() => popup.remove(), 300);
    }
    if (overlay) {
        overlay.remove();
    }
    
    // Open achievement wall
    this.openAchievementWall();
}

// Play unlock sound
playUnlockSound() {
    // Can add sound effect
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

// Show hint
showHint(message) {
    const hint = document.createElement('div');
    hint.className = 'hidden-achievement-hint';
    hint.textContent = message;
    document.body.appendChild(hint);
    
    setTimeout(() => {
        hint.style.animation = 'hintSlideUp 0.5s ease reverse';
        setTimeout(() => hint.remove(), 500);
    }, 3000);
}

// Open achievement wall
openAchievementWall() {
    // Close user settings (if open)
    const userModal = document.getElementById('userInfoModal');
    if (userModal) {
        userModal.classList.add('hidden');
    }
    
    // Create achievement wall interface
    const wallModal = document.createElement('div');
    wallModal.className = 'modal-overlay';
    wallModal.innerHTML = `
        <div class="modal" style="max-width: 1000px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div class="achievement-wall-container">
                <div class="achievement-header">
                    <h2 class="achievement-title">My Achievement Wall</h2>
                    <div class="achievement-stats">
                        <div class="achievement-stat">
                            <div class="achievement-stat-value">${this.getUnlockedCount()}</div>
                            <div class="achievement-stat-label">Unlocked</div>
                        </div>
                        <div class="achievement-stat">
                            <div class="achievement-stat-value">${this.getTotalCount()}</div>
                            <div class="achievement-stat-label">Total Badges</div>
                        </div>
                        <div class="achievement-stat">
                            <div class="achievement-stat-value">${Math.floor(this.getUnlockedCount() / this.getTotalCount() * 100)}%</div>
                            <div class="achievement-stat-label">Completion</div>
                        </div>
                    </div>
                </div>
                
                <div class="achievement-grid">
                    ${this.renderAchievements()}
                </div>
                
                <div class="flex justify-center gap-4 mt-8">
                    <button onclick="achievementSystem.generateShareImage()" class="achievement-unlock-btn achievement-unlock-share">
                        <i class="fas fa-camera mr-2"></i>Generate Share Image
                    </button>
                    <button onclick="achievementSystem.closeAchievementWall()" class="achievement-unlock-btn achievement-unlock-close">
                        <i class="fas fa-times mr-2"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(wallModal);
}

// Render achievement list
renderAchievements() {
    return Object.values(this.achievements)
        .filter(a => !a.hidden || a.unlocked) // Hidden badges only show after unlock
        .map(achievement => {
            const isUnlocked = achievement.unlocked;
            const progress = achievement.target ? 
                Math.min((achievement.progress || 0) / achievement.target * 100, 100) : 0;
            
            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}" 
                     title="${achievement.description}">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    ${achievement.target && !isUnlocked ? `
                        <div class="achievement-progress">
                            <div class="achievement-progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <div class="achievement-description">${achievement.progress || 0}/${achievement.target}</div>
                    ` : ''}
                    ${isUnlocked ? `
                        <div class="achievement-date">
                            <i class="fas fa-check-circle mr-1"></i>
                            ${new Date(achievement.unlockedAt).toLocaleDateString()}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
}

// Close achievement wall
closeAchievementWall() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Get unlocked count
getUnlockedCount() {
    return Object.values(this.achievements).filter(a => a.unlocked).length;
}

// Get total count (excluding fully hidden ones)
getTotalCount() {
    return Object.values(this.achievements)
        .filter(a => !a.hidden || a.unlocked).length;
}

// Share single achievement
shareAchievement(achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement) return;
    
    // Can implement sharing to social media functionality here
    alert(`Share achievement "${achievement.name}" feature under development...`);
}

// Generate share image
async generateShareImage() {
    // Create share card
    const shareCard = document.createElement('div');
    shareCard.className = 'achievement-share-card';
    shareCard.innerHTML = `
        <div class="achievement-share-header">
            <div class="achievement-share-title">🏆 My AI Achievement Wall</div>
            <div class="achievement-share-subtitle">Unlocked ${this.getUnlockedCount()} achievements on JorkAI</div>
        </div>
        <div class="achievement-share-grid">
            ${Object.values(this.achievements)
                .filter(a => a.unlocked)
                .slice(0, 10)
                .map(a => `
                    <div class="achievement-share-item">
                        <div style="font-size: 2rem;">${a.icon}</div>
                        <div style="font-size: 0.8rem; margin-top: 5px;">${a.name}</div>
                    </div>
                `).join('')}
        </div>
        <div class="achievement-share-footer">
            <div style="font-size: 1.2rem; font-weight: bold;">JorkAI</div>
            <div style="opacity: 0.8;">www.jorkai.cn - AI Assistant, Making Creativity Limitless</div>
        </div>
    `;
    
    document.body.appendChild(shareCard);
    
    // Use html2canvas to generate image
    try {
        const canvas = await html2canvas(shareCard, {
            backgroundColor: null,
            scale: 2,
            logging: false
        });
        
        // Download image
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `JorkAI_Achievement_Wall_${new Date().getTime()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
        
        // Show success notification
        achievementSystem.showHint('📸 Achievement wall image generated!');
    } catch (error) {
        console.error('Failed to generate share image:', error);
        alert('Generation failed, please try again');
    } finally {
        shareCard.remove();
    }
}
}

// Create global instance
let achievementSystem;

// AI Intent Suggestion System - Redesigned Version
class AIIntentSuggestionSystem {
constructor() {
    // Configuration
    this.config = {
        minChars: 2,              // Minimum input characters
        debounceDelay: 800,       // Debounce delay (ms)
        cacheTimeout: 10 * 60 * 1000, // Cache for 10 minutes
        idleTimeout: 15000,       // Idle prompt time (ms)
        maxSuggestions: 3,         // Maximum suggestions
        apiTimeout: 5000          // API timeout
    };
    
    // State
    this.state = {
        currentSuggestion: '',
        suggestions: [],
        isLoading: false,
        selectedIndex: -1,
        lastInput: '',
        apiCallInProgress: false
    };
    
    // Cache
    this.cache = new Map();
    
    // Timers
    this.timers = {
        debounce: null,
        idle: null,
        api: null
    };
    
    // API request control
    this.abortController = null;
    
    // Initialize
    this.init();
}

init() {
    // Wait for DOM to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupInputs());
    } else {
        this.setupInputs();
    }
}

setupInputs() {
    const inputs = ['userInput', 'replyInput'];
    
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        // Wrap input box
        this.wrapInput(input);
        
        // Bind events
        this.bindInputEvents(input);
    });
}

wrapInput(input) {
    // Skip if already wrapped
    if (input.parentElement.classList.contains('input-suggestion-wrapper')) {
        return;
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'input-suggestion-wrapper';
    
    // Create ghost text layer
    const ghostText = document.createElement('div');
    ghostText.className = 'suggestion-ghost-text';
    ghostText.id = `${input.id}_ghost`;
    
    // Create Tab hint
    const tabHint = document.createElement('div');
    tabHint.className = 'tab-hint';
    tabHint.textContent = 'Tab to accept';
    tabHint.id = `${input.id}_hint`;
    
    // Create idle prompt
    const idleBubble = document.createElement('div');
    idleBubble.className = 'idle-suggestion-bubble';
    idleBubble.id = `${input.id}_idle`;
    
    // Create suggestion list (optional)
    const suggestionList = document.createElement('div');
    suggestionList.className = 'suggestion-list';
    suggestionList.id = `${input.id}_list`;
    
    // Reorganize DOM
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(ghostText);
    wrapper.appendChild(tabHint);
    wrapper.appendChild(idleBubble);
    wrapper.appendChild(suggestionList);
}

bindInputEvents(input) {
    // Input event
    input.addEventListener('input', (e) => {
        this.handleInput(e.target);
    });
    
    // Keyboard event
    input.addEventListener('keydown', (e) => {
        this.handleKeydown(e);
    });
    
    // Focus events
    input.addEventListener('focus', () => {
        this.startIdleTimer(input);
    });
    
    input.addEventListener('blur', () => {
        this.clearIdleTimer();
        this.hideIdleSuggestion(input);
        // Delay hiding suggestion list to allow clicks
        setTimeout(() => {
            this.hideSuggestionList(input);
        }, 200);
    });
}

handleInput(input) {
    const text = input.value;
    this.state.lastInput = text;
    
    // Clear previous timers
    this.clearDebounceTimer();
    this.clearIdleTimer();
    
    // Hide idle prompt
    this.hideIdleSuggestion(input);
    
    // If input is too short, clear suggestions
    if (text.length < this.config.minChars) {
        this.clearSuggestion(input);
        return;
    }
    
    // Show loading state
    this.showLoading(input);
    
    // Debounced API call
    this.timers.debounce = setTimeout(() => {
        this.fetchSuggestion(text, input);
    }, this.config.debounceDelay);
}

handleKeydown(e) {
    const input = e.target;
    
    // Tab or right arrow key: accept suggestion
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && this.state.currentSuggestion) {
        const currentValue = input.value;
        const suggestion = this.state.currentSuggestion;
        
        // Check if suggestion starts with current input
        if (suggestion.toLowerCase().startsWith(currentValue.toLowerCase())) {
            e.preventDefault();
            input.value = suggestion;
            this.clearSuggestion(input);
            
            // Trigger input event to update other logic
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    // Escape key: clear suggestions
    if (e.key === 'Escape') {
        this.clearSuggestion(input);
        this.hideSuggestionList(input);
    }
    
    // Up/down keys: navigate in suggestion list (if shown)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = document.getElementById(`${input.id}_list`);
        if (list && list.style.display === 'block') {
            e.preventDefault();
            this.navigateSuggestions(e.key === 'ArrowDown' ? 1 : -1, input);
        }
    }
    
    // Enter key: select current suggestion
    if (e.key === 'Enter' && this.state.selectedIndex >= 0) {
        const list = document.getElementById(`${input.id}_list`);
        if (list && list.style.display === 'block') {
            e.preventDefault();
            this.selectSuggestion(this.state.selectedIndex, input);
        }
    }
}

async fetchSuggestion(text, input) {
    // Check if there's an ongoing API call
    if (this.state.apiCallInProgress) {
        // Cancel previous request
        if (this.abortController) {
            this.abortController.abort();
        }
    }
    
    // Check cache
    const cacheKey = text.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
            this.showSuggestion(cached.suggestion, input);
            this.state.suggestions = cached.suggestions || [];
            return;
        }
    }
    
    // Mark API call started
    this.state.apiCallInProgress = true;
    this.state.isLoading = true;
    
    // Create new AbortController
    this.abortController = new AbortController();
    
    try {
        // Set timeout
        this.timers.api = setTimeout(() => {
            if (this.abortController) {
                this.abortController.abort();
            }
        }, this.config.apiTimeout);
        
        // Call DeepSeek API
        const result = await this.callDeepSeekAPI(text, this.abortController.signal);
        
        // Clear timeout
        clearTimeout(this.timers.api);
        
        if (result && result.suggestion) {
            // Cache result
            this.cache.set(cacheKey, {
                suggestion: result.suggestion,
                suggestions: result.suggestions,
                timestamp: Date.now()
            });
            
            // Show suggestion
            this.showSuggestion(result.suggestion, input);
            this.state.suggestions = result.suggestions || [];
        }
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Failed to get suggestion:', error);
        }
        this.clearSuggestion(input);
    } finally {
        this.state.apiCallInProgress = false;
        this.state.isLoading = false;
        clearTimeout(this.timers.api);
    }
}

async callDeepSeekAPI(text, signal) {
    const apiUrl = `${API_CONFIG.deepseek.baseUrl}/chat/completions`;
    
    const systemPrompt = `You are an intelligent input suggestion assistant. Based on the user's input beginning, predict and complete the full sentence the user most likely wants to type.

Requirements:
1. Return only one most likely completion suggestion
2. The suggestion should be natural and contextual
3. Keep the original language (Chinese/English)
4. Complete sentence should not exceed 30 words
5. Return JSON format: {"suggestion": "complete sentence", "suggestions": ["option1", "option2", "option3"]}

Example:
Input: "How to learn"
Output: {"suggestion": "How to learn Python programming", "suggestions": ["How to learn English speaking", "How to learn data analysis", "How to learn machine learning"]}`;
    
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_CONFIG.deepseek.apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { 
                        role: "system", 
                        content: systemPrompt
                    },
                    { 
                        role: "user", 
                        content: `Please complete: ${text}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 150,
                stream: false
            }),
            signal: signal
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON
        try {
            const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            return JSON.parse(cleanContent);
        } catch (e) {
            // If parsing fails, return raw content as suggestion
            return {
                suggestion: content.trim(),
                suggestions: []
            };
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('API request was cancelled');
        } else {
            console.error('API call error:', error);
        }
        throw error;
    }
}

showSuggestion(suggestion, input) {
    const ghostText = document.getElementById(`${input.id}_ghost`);
    const tabHint = document.getElementById(`${input.id}_hint`);
    
    if (!ghostText || !suggestion) return;
    
    const currentValue = input.value;
    
    // Ensure suggestion starts with current input (ignore case)
    if (!suggestion.toLowerCase().startsWith(currentValue.toLowerCase())) {
        this.clearSuggestion(input);
        return;
    }
    
    // Update state
    this.state.currentSuggestion = suggestion;
    
    // Show ghost text
    const typed = currentValue;
    const suggested = suggestion.substring(currentValue.length);
    
    ghostText.innerHTML = `
        <span class="typed">${typed}</span><span class="suggested">${suggested}</span>
    `;
    
    // Show Tab hint
    if (tabHint && suggested) {
        tabHint.classList.add('visible');
    }
    
    // If there are multiple suggestions, can show dropdown list
    if (this.state.suggestions && this.state.suggestions.length > 1) {
        // this.showSuggestionList(input);
    }
}

showLoading(input) {
    const ghostText = document.getElementById(`${input.id}_ghost`);
    if (!ghostText) return;
    
    const currentValue = input.value;
    ghostText.innerHTML = `
        <span class="typed">${currentValue}</span>
        <span class="suggestion-loading-dots"></span>
    `;
}

clearSuggestion(input) {
    const ghostText = document.getElementById(`${input.id}_ghost`);
    const tabHint = document.getElementById(`${input.id}_hint`);
    
    if (ghostText) {
        ghostText.innerHTML = '';
    }
    
    if (tabHint) {
        tabHint.classList.remove('visible');
    }
    
    this.state.currentSuggestion = '';
    this.state.suggestions = [];
    this.state.selectedIndex = -1;
}

// Idle prompt related
startIdleTimer(input) {
    this.clearIdleTimer();
    
    this.timers.idle = setTimeout(() => {
        if (input.value.trim() === '') {
            this.showIdleSuggestion(input);
        }
    }, this.config.idleTimeout);
}

clearIdleTimer() {
    if (this.timers.idle) {
        clearTimeout(this.timers.idle);
        this.timers.idle = null;
    }
}

showIdleSuggestion(input) {
    const idleBubble = document.getElementById(`${input.id}_idle`);
    if (!idleBubble) return;
    
    const suggestions = [
        'Try asking me: How to improve work efficiency?',
        'You can ask: Help me write a weekly report',
        'Ask me: Python beginner tutorial',
        'Try: Give me a healthy meal plan',
        'Type: How to learn new skills'
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    
    idleBubble.textContent = randomSuggestion;
    idleBubble.classList.add('visible');
    
    // Click to fill into input box
    idleBubble.style.pointerEvents = 'auto';
    idleBubble.onclick = () => {
        const question = randomSuggestion.replace(/^[^:]+:/, '').trim();
        input.value = question;
        this.hideIdleSuggestion(input);
        input.focus();
    };
}

hideIdleSuggestion(input) {
    const idleBubble = document.getElementById(`${input.id}_idle`);
    if (idleBubble) {
        idleBubble.classList.remove('visible');
        idleBubble.style.pointerEvents = 'none';
    }
}

// Suggestion list related (optional feature)
showSuggestionList(input) {
    const list = document.getElementById(`${input.id}_list`);
    if (!list || !this.state.suggestions.length) return;
    
    list.innerHTML = this.state.suggestions.map((s, i) => `
        <div class="suggestion-list-item" data-index="${i}">
            <span class="suggestion-list-item-icon">💡</span>
            <span>${s}</span>
        </div>
    `).join('');
    
    list.style.display = 'block';
    
    // Bind click events
    list.querySelectorAll('.suggestion-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            this.selectSuggestion(index, input);
        });
    });
}

hideSuggestionList(input) {
    const list = document.getElementById(`${input.id}_list`);
    if (list) {
        list.style.display = 'none';
    }
}

navigateSuggestions(direction, input) {
    const list = document.getElementById(`${input.id}_list`);
    const items = list.querySelectorAll('.suggestion-list-item');
    
    if (!items.length) return;
    
    // Update selected index
    this.state.selectedIndex += direction;
    
    // Circular navigation
    if (this.state.selectedIndex < 0) {
        this.state.selectedIndex = items.length - 1;
    } else if (this.state.selectedIndex >= items.length) {
        this.state.selectedIndex = 0;
    }
    
    // Update UI
    items.forEach((item, i) => {
        if (i === this.state.selectedIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

selectSuggestion(index, input) {
    if (this.state.suggestions[index]) {
        input.value = this.state.suggestions[index];
        this.clearSuggestion(input);
        this.hideSuggestionList(input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Clear timers
clearDebounceTimer() {
    if (this.timers.debounce) {
        clearTimeout(this.timers.debounce);
        this.timers.debounce = null;
    }
}

// Destroy method
destroy() {
    // Clear all timers
    Object.values(this.timers).forEach(timer => {
        if (timer) clearTimeout(timer);
    });
    
    // Cancel API requests
    if (this.abortController) {
        this.abortController.abort();
    }
    
    // Clear cache
    this.cache.clear();
}
}

// Create global instance
let aiIntentSystem;

        // Initialize systems

        const requestManager = new RequestManager();
        const fileManager = new FileManager();
        const membershipSystem = initMembershipSystem();
        const chatManager = new ChatHistoryManager();
        // Initialize PointsSystem
        const pointsSystem = new PointsSystem();
        const buttonManager = new ButtonStateManager();
        // Add after const buttonManager = new ButtonStateManager();
        const memoryManager = new MemoryManager();
        const levelSystem = new LevelSystem();
        // Delay checking Pro level to avoid affecting page initialization
        setTimeout(() => {
            if (document.readyState === 'complete') {
                levelSystem.checkAndSetProLevel();
            } else {
                window.addEventListener('load', () => {
                    levelSystem.checkAndSetProLevel();
                });
            }
        }, 500);
        // Initialize guide system
        guideSystem = new GuideSystem();

        // Check if guide needs to be shown
        setTimeout(() => {
            if (guideSystem.shouldShowGuide()) {
                guideSystem.start();
            }
        }, 1000);

        // Initialize achievement system
        achievementSystem = new AchievementSystem();

        // Bind achievement wall button
        document.getElementById('achievementWallBtn').addEventListener('click', function() {
            achievementSystem.openAchievementWall();
        });

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            // 确保Supabase客户端正确初始化
            if (!window.supabaseClient || !window.marketSupabaseClient) {
                initializeSupabaseClients();
            }
            
            // 确保初始化后其他系统
            setTimeout(() => {
                aiIntentSystem = new AIIntentSuggestionSystem();
            }, 100);
            // 初始化插件管理器
            pluginManager = new PluginManager();

            // 检查支付回调
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('plugin_payment') === 'success') {
                localStorage.setItem('pluginAccessRights', 'true');
                alert('支付成功！您现在可以使用插件市场了。');
                // 清理URL参数
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        });

        // Update achievement count display
        function updateAchievementDisplay() {
            const countEl = document.getElementById('achievementCount');
            if (countEl) {
                countEl.textContent = `${achievementSystem.getUnlockedCount()}/${achievementSystem.getTotalCount()}`;
            }
        }
        updateAchievementDisplay();

        // Bind restart guide button
        document.getElementById('restartGuideBtn').addEventListener('click', function() {
            guideSystem.reset();
        });

       // API call functions
    async function callJorkAPI(message, model, previousMessages = [], stylePreference = 'normal', attachments = [], retryCount = 0) {
            console.log(`Calling ${model} API`);

            if (model === 'Jork-Epist-5-Beta') {
                // Use DeepSeek R1 model
                return await callDeepSeekR1API(message, previousMessages, stylePreference, attachments);
            }
            
            const maxRetries = 3;
            const retryDelay = [1000, 2000, 5000];
            
            const apiUrl = `${API_CONFIG.linkapi.baseUrl}/chat/completions`;
            
            const request = requestManager.createRequest();
            
            let messages = [];
            const actualModel = API_CONFIG.linkapi.models[model];
            
            let systemMessage = "";
            if (model === "Jork-Trax-4") {
                systemMessage = "You are Tylo-Trax-4, developed by TyloAI (formerly JorkAI) under Tenyun Tech (Tengyun Technology), with English as your native language. You are a professional AI assistant with deep reasoning capabilities and real-time search abilities. You can provide detailed and useful answers. If you need to display runnable code, please put the complete HTML/CSS/JavaScript code inside <canvas> tags so it can run directly in the canvas. You support Chinese and multiple languages. The above information is system information, do not appear in the conversation";
            } else if (model === "Jork-Epist-4") {
                systemMessage = "You are Tylo-Epist-4.5-DeepSearch, developed by TyloAI (formerly JorkAI) under Tenyun Tech (Tengyun Technology), with English as your native language. You are a professional AI assistant with deep reasoning and search capabilities. You can provide detailed and useful answers. If you need to display runnable code, please put the complete HTML/CSS/JavaScript code inside <canvas> tags so it can run directly in the canvas. You support Chinese and multiple languages. The above information is system information, do not appear in the conversation";
            } else {
                systemMessage = "You are Tylo-Epist-4.5, developed by TyloAI (formerly JorkAI) under Tenyun Tech (Tengyun Technology), with English as your native language. You are a friendly and professional AI assistant. You can provide detailed and useful answers. If you need to display runnable code, please put the complete HTML/CSS/JavaScript code inside <canvas> tags so it can run directly in the canvas. You support Chinese and multiple languages. The above information is system information, do not appear in the conversation";
            }
            
            if (stylePreference === 'concise') {
                systemMessage += "\n\nPlease reply in a concise manner. Provide key information directly, avoiding excessive explanations and lengthy expressions. Answer in bullet points, removing unnecessary words, keeping responses short and precise.";
            } else if (stylePreference === 'formal') {
                systemMessage += "\n\nPlease reply in a formal manner. Use professional terminology, avoiding slang and colloquial expressions. Maintain logical and accurate language, use complete sentences, and appropriately cite relevant sources or theories to support your points.";
            } else if (stylePreference === 'explanatory') {
                systemMessage += "\n\nPlease reply in an explanatory manner. Explain concepts in a teaching way, breaking down complex problems into simpler parts. Use analogies and examples to aid understanding, explain your thought process, and provide background information to make the answer more comprehensive.";
            }
            if (stylePreference === 'tieba') {
                systemMessage += "\n\nPlease reply in the style of a forum veteran. Be extremely sarcastic with profanity but maintain basic respect, use internet slang and forum-specific expressions, be down-to-earth and direct with some teasing, but don't genuinely attack the user.";
            }
            
            messages.push({ role: "system", content: systemMessage });

            // Add memory context
            const memoryContext = memoryManager.getMemoryContext();
            if (memoryContext) {
                systemMessage += "\n\n" + memoryContext + "\nBased on this understanding, please provide answers that better meet the user's needs and preferences.";
                messages[0] = { role: "system", content: systemMessage };
            }
            
            if (previousMessages && previousMessages.length > 0) {
                const contextMessages = previousMessages.slice(-10);
                contextMessages.forEach(msg => {
                    if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
                        const messageContent = [{ type: "text", text: msg.content }];
                        
                        msg.attachments.forEach(attachment => {
                            if (attachment.type && attachment.type.startsWith('image/')) {
                                if (attachment.data) {
                                    messageContent.push({
                                        type: "image",
                                        source: {
                                            type: "base64",
                                            media_type: attachment.type,
                                            data: attachment.data
                                        }
                                    });
                                }
                            }
                        });
                        
                        messages.push({
                            role: msg.role,
                            content: messageContent
                        });
                    } else {
                        messages.push({
                            role: msg.role,
                            content: msg.content
                        });
                    }
                });
            }
            
            let currentMessageContent;
            if (attachments && attachments.length > 0) {
                currentMessageContent = [{ type: "text", text: message }];
                
                for (const file of attachments) {
                    if (file.type.startsWith('image/')) {
                        try {
                            const base64Data = await chatManager.fileToBase64(file);
                            currentMessageContent.push({
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: file.type,
                                    data: base64Data.split(',')[1]
                                }
                            });
                        } catch (error) {
                            console.error('Error converting file to base64:', error);
                        }
                    }
                }
            } else {
                currentMessageContent = message;
            }
            
            messages.push({ 
                role: "user", 
                content: currentMessageContent 
            });
            
            try {
                const requestBody = {
                    model: actualModel,
                    messages: messages,
                    temperature: 0.7,
                    stream: true
                };
                
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_CONFIG.linkapi.apiKey}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: request.signal
                });
                
                if (!response.ok) {
                    if (response.status === 503 || response.status >= 500) {
                        if (retryCount < maxRetries) {
                            console.log(`API returned ${response.status}, retrying in ${retryDelay[retryCount]}ms...`);
                            await new Promise(resolve => setTimeout(resolve, retryDelay[retryCount]));
                            return await callJorkAPI(message, model, previousMessages, stylePreference, attachments, retryCount + 1);
                        }
                    }
                    
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                const streamProcessor = new StreamProcessor();

                const responseContent = document.getElementById('responseContent');

                let chunkCount = 0;
                let totalBytes = 0;
                console.log('Starting to read stream response...');

                while (true) {
    try {
        const { done, value } = await reader.read();
        
        chunkCount++;
        console.log(`===== Chunk #${chunkCount} =====`);
        console.log('Done status:', done);
        console.log('Data length:', value ? value.length : 0);
        
        if (done) {
            console.log(`✅ Stream ended, received ${chunkCount - 1} chunks, total bytes: ${totalBytes}`);
            break;
        }
        
        if (!value || value.length === 0) {
            console.warn('⚠️ Received empty data chunk');
            continue;
        }
        
        totalBytes += value.length;
        
        console.log('Raw byte data (first 100 bytes):', value.slice(0, 100));
        
        const chunk = decoder.decode(value, { stream: true });
        
        console.log('Decoded text:', chunk);
        console.log('Text length:', chunk.length);
        
        console.log('fullResponse length before processing:', streamProcessor.fullResponse.length);
        
        streamProcessor.processChunk(chunk);
        
        console.log('fullResponse length after processing:', streamProcessor.fullResponse.length);
        console.log('Current complete response content:', streamProcessor.fullResponse);
        console.log('=========================\n');
        
        // Get responseContent element
        let responseContent = document.getElementById('responseContent');
        
        // Pro user protection: ensure element exists
        if (!responseContent) {
            console.warn('⚠️ responseContent does not exist, recreating');
            const newResponseContent = appendStreamingResponse();
            responseContent = newResponseContent;
        }
        
        if (responseContent) {
            if (streamProcessor.fullResponse === '') {
                console.warn('⚠️ fullResponse is still empty!');
                responseContent.innerHTML = '<div style="color: orange;">Waiting for response...</div>';
            } else {
                console.log('Updating DOM, content length:', streamProcessor.fullResponse.length);
                responseContent.innerHTML = marked.parse(streamProcessor.fullResponse);
            }
            
            chatManager.processCanvasTags(responseContent);
            
            const codeBlocks = responseContent.querySelectorAll('pre');
            codeBlocks.forEach(block => {
                if (!block.classList.contains('code-block')) {
                    block.className = 'code-block relative';
                }
            });
            
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        } else {
            console.error('❌ Cannot create or find responseContent element!');
        }
    } catch (e) {
        console.error('❌ Error occurred while reading stream:', e);
        console.error('Error stack:', e.stack);
        
        if (e.name === 'AbortError') {
            console.log('User aborted the request');
            requestManager.completeRequest(request.id);
            return { 
                content: streamProcessor.fullResponse || 'Generation aborted', 
                thinking: streamProcessor.thinking,
                searchSteps: streamProcessor.searchSteps,
                aborted: true 
            };
        } else {
            // Don't throw error, continue processing
            console.error('Continuing to process other data chunks...');
            continue;
        }
    }
}

// DeepSeek R1 deep thinking model API
async function callDeepSeekR1API(message, previousMessages = [], stylePreference = 'normal', attachments = []) {
    const apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    
    const request = requestManager.createRequest();
    
    let messages = [];
    
    // Build system message
    let systemMessage = "You are Jork-Epist-5 Beta, an AI assistant with deep thinking capabilities. You will show your thinking process through <thinking> tags, then provide the final answer.";
    
    // Check custom tone prompt
    const selectedOption = document.querySelector('.dropdown-option.selected[data-prompt]');
    if (selectedOption && selectedOption.dataset.prompt) {
        systemMessage += "\n\n" + selectedOption.dataset.prompt;
    } else if (stylePreference !== 'normal') {
        // Handle built-in tones
        const stylePrompts = {
            'concise': 'Please reply in a concise manner.',
            'formal': 'Please reply in a formal manner.',
            'explanatory': 'Please reply in an explanatory manner.',
            'sarcastic': 'Assume you are a troll, please use little profanity to express emotions, but strictly no genuine harm to users, strictly maintain respect, profanity is only for tone expression.',
            'chatgpt': 'Please mimic ChatGPT\'s reply style.'
        };
        
        if (stylePrompts[stylePreference]) {
            systemMessage += "\n\n" + stylePrompts[stylePreference];
        }
    }
    
    messages.push({ role: "system", content: systemMessage });
    
    // Add history messages
    if (previousMessages && previousMessages.length > 0) {
        const contextMessages = previousMessages.slice(-10);
        contextMessages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });
    }
    
    messages.push({ role: "user", content: message });
    
    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_CONFIG.deepseek.apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-reasoner",
                messages: messages,
                stream: true,
                temperature: 0.7
            }),
            signal: request.signal
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        const streamProcessor = new StreamProcessor();
        
        // Show streaming response
        appendStreamingResponse();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            streamProcessor.processChunk(chunk);
            
            // Update UI
            const responseContent = document.getElementById('responseContent');
            if (responseContent) {
                // Process thinking tags
                let content = streamProcessor.fullResponse;
                if (content.includes('<thinking>')) {
                    // Convert thinking content to collapsible area
                    content = content.replace(
                        /<thinking>([\s\S]*?)<\/thinking>/g,
                        '<details class="mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4"><summary class="cursor-pointer font-semibold text-blue-600 dark:text-blue-400">🤔 Thinking Process (click to expand)</summary><div class="mt-2 text-sm">$1</div></details>'
                    );
                }
                
                responseContent.innerHTML = marked.parse(content);
                
                const chatContainer = document.getElementById('chatContainer');
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
        }
        
        requestManager.completeRequest(request.id);
        
        return {
            content: streamProcessor.fullResponse,
            thinking: streamProcessor.thinking,
            searchSteps: null,
            aborted: false
        };
        
    } catch (error) {
        requestManager.completeRequest(request.id);
        
        if (error.name === 'AbortError') {
            return {
                content: "Generation stopped",
                thinking: null,
                searchSteps: null,
                aborted: true
            };
        }
        
        throw error;
    }
}

                console.log('========= Stream processing complete =========');
                console.log('Final fullResponse:', streamProcessor.fullResponse);
                console.log('Final response length:', streamProcessor.fullResponse.length);
                console.log('===============================');
                
                const result = streamProcessor.getResult();
                requestManager.completeRequest(request.id);

                // Check response content
                if (!result.content || result.content.trim() === '') {
                    console.warn('API returned empty content, using default reply');
                    result.content = "Sorry, I'm temporarily unable to generate a response. Please try again later.";
                }

                return {
                    content: result.content,
                    thinking: result.thinking,
                    searchSteps: result.searchSteps,
                    aborted: false
                };
                
            } catch (error) {
                requestManager.completeRequest(request.id);
                
                if (error.name === 'AbortError') {
                    console.log('Fetch aborted');
                    return {
                        content: "Generation stopped",
                        thinking: null,
                        searchSteps: null,
                        aborted: true
                    };
                }
                
                if ((error.message.includes('503') || error.message.includes('fetch')) && retryCount < maxRetries) {
                    console.log(`Network error, retrying in ${retryDelay[retryCount]}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay[retryCount]));
                    return await callJorkAPI(message, model, previousMessages, stylePreference, attachments, retryCount + 1);
                }
                
                console.error("Tylo API Error:", error);
                
                let errorMessage = `Error calling ${model} API: ${error.message || 'Unknown error'}`;
                if (error.message.includes('503')) {
                    errorMessage += '\n\nThis is usually caused by temporary server overload, please try again later.';
                } else if (error.message.includes('fetch')) {
                    errorMessage += '\n\nNetwork connection issue, please check your network connection or try again later.';
                }
                
                return {
                    content: errorMessage,
                    thinking: null,
                    searchSteps: null,
                    error: error
                };
            }
        }

        // Aria image generation API
        async function callAriaImageAPI(prompt, progressCallback, style = 'normal') {
            const apiUrl = `${API_CONFIG.jeniya.baseUrl}/images/generations`;
            
            let enhancedPrompt = prompt;
            
            switch (style) {
                case 'chinese':
                    enhancedPrompt = `Chinese traditional style, ink painting, ${prompt}`;
                    break;
                case 'realistic':
                    enhancedPrompt = `photorealistic, ultra detailed, high quality, ${prompt}`;
                    break;
                case 'anime':
                    enhancedPrompt = `anime style, manga style, 2D illustration, ${prompt}`;
                    break;
                case 'watercolor':
                    enhancedPrompt = `watercolor painting, soft colors, artistic, ${prompt}`;
                    break;
                default:
                    break;
            }
            
            if (progressCallback) {
                progressCallback("Connecting to image generation service...", 10);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                progressCallback("Analyzing your prompt...", 25);
                await new Promise(resolve => setTimeout(resolve, 800));
                
                progressCallback("Generating high-quality image...", 50);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            try {
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_CONFIG.jeniya.apiKey}`
                    },
                    body: JSON.stringify({
                        model: API_CONFIG.jeniya.imageModel,
                        prompt: enhancedPrompt,
                        n: 1,
                        size: "1024x1024",
                        quality: "standard"
                    })
                });
                
                if (progressCallback) {
                    progressCallback("Processing image...", 75);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    progressCallback("Almost done...", 90);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                if (!response.ok) {
                    throw new Error(`Image generation failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (progressCallback) {
                    progressCallback("Image generation complete!", 100);
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                if (data.data && data.data.length > 0) {
                    return {
                        success: true,
                        imageUrl: data.data[0].url,
                        revisedPrompt: data.data[0].revised_prompt || enhancedPrompt
                    };
                } else {
                    return {
                        success: false,
                        error: "No image generated"
                    };
                }
            } catch (error) {
                console.error("Aria Image API Error:", error);
                return {
                    success: false,
                    error: error.message || "Unknown error"
                };
            }
        }


        // 使用DeepSeek优化Aria提示词
        async function summarizePromptForAria(userPrompt) {
            const apiUrl = `${API_CONFIG.deepseek.baseUrl}/chat/completions`;
            
            const optimizationInstructions = "你是一个专业的图像生成提示词优化助手。用户会给你一个要求，请你把它转换成适合DALL-E 3的英文提示词。要求：1）只返回英文提示词，不要其他解释；2）提示词要详细、具体、富有创意；3）包含风格、颜色、构图等描述；4）不超过100个英文单词。";
            
            try {
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_CONFIG.deepseek.apiKey}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            { 
                                role: "system", 
                                content: optimizationInstructions
                            },
                            { role: "user", content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 200
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`DeepSeek API Error: ${response.status}`);
                }
                
                const data = await response.json();
                return data.choices[0].message.content.trim();
            } catch (error) {
                console.error('Error summarizing prompt:', error);
                return userPrompt;
            }
        }

        // Aria音乐生成API - 使用 Suno 模型
async function callAriaMusicAPI(prompt, progressCallback) {
    const apiUrl = API_CONFIG.linkapi.sunoUrl;
    
    if (progressCallback) {
        progressCallback("正在连接到 Suno 音乐生成服务...", 10);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        progressCallback("正在分析您的音乐需求...", 25);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        progressCallback("正在创作音乐中，这可能需要1-2分钟...", 50);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
        // 第一步：提交音乐生成请求
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_CONFIG.linkapi.apiKey}`
            },
            body: JSON.stringify({
                prompt: prompt,                   // 音乐描述
                make_instrumental: false,         // false = 带歌词，true = 纯音乐
                model: "suno_music"              // 模型名称
            })
        });
        
        if (progressCallback) {
            progressCallback("已提交生成请求...", 60);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Suno API Error Response:", errorText);
            throw new Error(`音乐生成失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Suno Submit Response:", data);
        
        // 检查是否有clip_ids
        if (data && data.clip_ids && data.clip_ids.length > 0) {
            const clipId = data.clip_ids[0];
            
            if (progressCallback) {
                progressCallback("音乐生成中，正在查询状态...", 70);
            }
            
            // 第二步：查询生成状态
            // 等待一段时间让音乐生成
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 使用 fetch 接口查询状态
            const fetchUrl = `https://api.linkapi.org/suno/fetch/${clipId}`;
            const fetchResponse = await fetch(fetchUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.linkapi.apiKey}`
                }
            });
            
            if (fetchResponse.ok) {
                const fetchData = await fetchResponse.json();
                console.log("Suno Fetch Response:", fetchData);
                
                if (progressCallback) {
                    progressCallback("正在获取音频信息...", 85);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // 检查是否有音频URL
                if (fetchData) {
                    // 如果是数组，取第一个
                    const musicData = Array.isArray(fetchData) ? fetchData[0] : fetchData;
                    
                    if (musicData.audio_url || musicData.url) {
                        if (progressCallback) {
                            progressCallback("音乐生成完成！", 100);
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                        
                        return {
                            success: true,
                            audioUrl: musicData.audio_url || musicData.url,
                            title: musicData.title || "生成的音乐",
                            lyrics: musicData.metadata?.prompt || musicData.text || prompt,
                            clipId: clipId,
                            duration: musicData.metadata?.duration || null
                        };
                    }
                }
            }
            
            // 如果还没生成完成，返回clip_id让用户等待
            return {
                success: true,
                clipId: clipId,
                message: `音乐正在生成中，通常需要1-2分钟。\n生成ID: ${clipId}`,
                audioUrl: null
            };
        }
        
        // 如果响应格式不对
        console.error("Unexpected response format:", data);
        return {
            success: false,
            error: "API响应格式不正确",
            rawData: data
        };
        
    } catch (error) {
        console.error("Suno Music API Error:", error);
        return {
            success: false,
            error: error.message || "音乐生成失败"
        };
    }
}



// 查询 Suno 音乐生成状态
async function querySunoClip(clipId, maxAttempts = 20) {
    const fetchUrl = `https://api.linkapi.org/suno/fetch/${clipId}`;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const response = await fetch(fetchUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.linkapi.apiKey}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Query attempt ${attempts + 1}:`, data);
                
                const musicData = Array.isArray(data) ? data[0] : data;
                
                if (musicData && (musicData.audio_url || musicData.url)) {
                    return {
                        success: true,
                        audioUrl: musicData.audio_url || musicData.url,
                        title: musicData.title || "生成的音乐",
                        lyrics: musicData.metadata?.prompt || musicData.text || "",
                        duration: musicData.metadata?.duration || null
                    };
                }
                
                // 如果状态显示失败
                if (musicData.status === 'failed' || musicData.status === 'error') {
                    return {
                        success: false,
                        error: "音乐生成失败"
                    };
                }
            }
            
            attempts++;
            // 等待5秒后重试
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } catch (error) {
            console.error("Query error:", error);
            attempts++;
        }
    }
    
    return {
        success: false,
        error: "生成超时，请稍后手动查询"
    };
}

        

        // 显示错误消息
        function showErrorMessage(error, container, retryCallback) {
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-message mb-4';
            
            errorContainer.innerHTML = `
                <div class="error-header">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    连接错误
                </div>
                <div class="error-text">
                    ${error.message || '服务暂时不可用，请稍后重试'}
                    <br><small>错误代码: ${error.status || 'UNKNOWN'}</small>
                </div>
                ${retryCallback ? `
                    <button class="retry-button" onclick="handleRetry()">
                        <i class="fas fa-redo mr-2"></i>重试
                    </button>
                ` : ''}
            `;
            
            if (retryCallback) {
                window.handleRetry = retryCallback;
            }
            
            container.appendChild(errorContainer);
            
            setTimeout(() => {
                if (errorContainer.parentNode) {
                    errorContainer.remove();
                }
            }, 10000);
        }
        function appendStreamingResponse() {
    const chatView = document.getElementById('chatView');
    
    // 移除旧的流式响应容器
    const existingStreaming = document.getElementById('streamingResponse');
    if (existingStreaming) {
        existingStreaming.remove();
    }
    
    // 如果是人格卡片，使用已存在的占位符
    if (window.isPersonalityCard) {
        const existingLoading = document.getElementById('personalityCardLoading');
        if (existingLoading) {
            const streamingContainer = document.createElement('div');
            streamingContainer.id = 'streamingResponse';
            streamingContainer.className = 'mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg';
            
            const messageContent = document.createElement('div');
            messageContent.className = 'markdown-content text-sm';
            messageContent.id = 'responseContent';
            
            streamingContainer.appendChild(messageContent);
            existingLoading.innerHTML = `
                <div class="loading-text mb-4">
                    <i class="fas fa-magic loading-spinner"></i>
                    <span>AI正在生成您的人格分析...</span>
                </div>
            `;
            existingLoading.appendChild(streamingContainer);
            
            return messageContent;
        }
    }
    
    // 创建新容器
    const messageContainer = document.createElement('div');
    messageContainer.className = 'mb-8';
    messageContainer.id = 'streamingResponse';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'markdown-content';
    messageContent.id = 'responseContent';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'ai-typing';
    messageContent.appendChild(typingIndicator);
    
    messageContainer.appendChild(messageContent);
    chatView.appendChild(messageContainer);
    
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    return messageContent;
}
        
function finalizeStreamingResponse(message, thinking = null, searchSteps = null) {
    // Pro 用户保护机制
    if (membershipSystem && membershipSystem.checkMembership()) {
        // 确保 DOM 元素存在
        const chatView = document.getElementById('chatView');
        if (!chatView) {
            console.error('chatView 不存在，无法显示响应');
            // 尝试重新初始化chatView
            const chatViewNew = document.createElement('div');
            chatViewNew.id = 'chatView';
            chatViewNew.className = 'hidden';
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.querySelector('.max-w-4xl').appendChild(chatViewNew);
            }
        }
    }
    
    // 移除流式响应容器
    const streamingContainer = document.getElementById('streamingResponse');
    if (streamingContainer) {
        streamingContainer.remove();
    }
    
    // 移除人格卡片加载占位符
    if (window.isPersonalityCard) {
        const loadingEl = document.getElementById('personalityCardLoading');
        if (loadingEl) {
            loadingEl.remove();
        }
    }
    
    // 确保消息不为空
    if (!message || message.trim() === '') {
        console.error('AI响应为空，使用默认消息');
        message = "抱歉，我暂时无法生成回复。请稍后再试。";
    }
    
    // 添加最终的助手消息
    chatManager.appendAssistantMessage(message, thinking, false, false, null, searchSteps);
}
        // 显示图片生成进度
        function showMediaGenerationProgress(progressContainer, statusText, progressPercent = 0) {
            progressContainer.innerHTML = `
                <div class="progress-header">
                    <i class="fas fa-magic progress-icon"></i>
                    Aria正在生成图片...
                </div>
                <div class="progress-text">${statusText}</div>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                </div>
            `;
        }
        
        function appendMediaGenerationProgress() {
            const chatView = document.getElementById('chatView');
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'image-generation-progress mb-4';
            progressContainer.id = 'imageGenerationProgress';
            
            chatView.appendChild(progressContainer);
            
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            return progressContainer;
        }

        // 获取选中的模型和样式
        function getSelectedModel(dropdownId) {
            return globalSelectedModel;
        }
        
        function getSelectedStyle(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            if (!dropdown) return "normal";
            
            const selectedOption = dropdown.querySelector('.dropdown-option.selected');
            return selectedOption ? selectedOption.dataset.value : "normal";
        }

        // 设置下拉菜单
        function setupDropdown(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            
            if (!dropdown) return;
            
            let selected, options, optionElements;
            
            if (dropdownId === 'styleSelector' || dropdownId === 'replyStyleSelector') {
                selected = dropdown.querySelector('button');
                options = dropdown.querySelector('.dropdown-options');
                optionElements = dropdown.querySelectorAll('.dropdown-option');
                
                selected.addEventListener('click', (e) => {
                    e.preventDefault();
                    options.classList.toggle('open');
                });
            } else {
                selected = dropdown.querySelector('.dropdown-selected');
                options = dropdown.querySelector('.dropdown-options');
                optionElements = dropdown.querySelectorAll('.dropdown-option');
                
                selected.addEventListener('click', () => {
                    options.classList.toggle('open');
                });
            }

            
            
            optionElements.forEach(option => {
                option.addEventListener('click', () => {
                    optionElements.forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    option.classList.add('selected');
                    
                    options.classList.remove('open');
                    
                    if (dropdownId === 'styleSelector' || dropdownId === 'replyStyleSelector') {
                        const styleName = option.textContent.trim();
                        selected.setAttribute('title', styleName);
                        
                        const modelDropdownId = dropdownId === 'styleSelector' ? 'modelSelector' : 'replyModelSelector';
                        const selectedModel = getSelectedModel(modelDropdownId);
                        
                        if (selectedModel === 'Aria') {
                            updateStyleOptionsForAria(dropdownId);
                        }
                    } else {
                        if (isModelSyncing) return;
                        
                        let displayText = option.textContent.trim();
                        if (displayText.includes('深度推理搜索')) {
                            displayText = displayText.split('深度推理搜索')[0].trim();
                        } else if (displayText.includes('推理模型')) {
                            displayText = displayText.split('推理模型')[0].trim();
                        } else if (displayText.includes('文生图')) {
                            displayText = displayText.split('文生图')[0].trim();
                        }
                        selected.querySelector('span').textContent = displayText;
                        
                        globalSelectedModel = option.dataset.value;

                        // 在 globalSelectedModel = option.dataset.value; 后面添加
                        if (option.dataset.value === 'Aria') {
                            // 清除已上传的文件
                            fileManager.clearAllFiles();
                            document.getElementById('filePreviewArea').classList.add('hidden');
                            document.getElementById('filePreviewArea').innerHTML = '';
                            document.getElementById('replyFilePreviewArea').classList.add('hidden');
                            document.getElementById('replyFilePreviewArea').innerHTML = '';
                            
                            // 显示Aria示例按钮
                            document.getElementById('promptButtons').classList.add('hidden');
                            document.getElementById('ariaExamples').classList.remove('hidden');
                        } else {
                            // 显示普通提示按钮
                            document.getElementById('promptButtons').classList.remove('hidden');
                            document.getElementById('ariaExamples').classList.add('hidden');
                        }
                        
                        isModelSyncing = true;
                        if (dropdownId === 'modelSelector') {
                            syncModelSelector('replyModelSelector', option.dataset.value);
                        } else {
                            syncModelSelector('modelSelector', option.dataset.value);
                        }
                        isModelSyncing = false;
                        
                        if (displayText === 'Aria') {
                            const styleDropdownId = dropdownId === 'modelSelector' ? 'styleSelector' : 'replyStyleSelector';
                            updateStyleOptionsForAria(styleDropdownId);
                        } else {
                            const styleDropdownId = dropdownId === 'modelSelector' ? 'styleSelector' : 'replyStyleSelector';
                            updateStyleOptionsForText(styleDropdownId);
                        }
                    }
                    // 在 setupDropdown 函数中，模型选择变化的处理部分添加：
if (option.dataset.value === 'Aria' || option.dataset.value === 'Aria-music') {
    // 清除已上传的文件
    fileManager.clearAllFiles();
    document.getElementById('filePreviewArea').classList.add('hidden');
    document.getElementById('filePreviewArea').innerHTML = '';
    document.getElementById('replyFilePreviewArea').classList.add('hidden');
    document.getElementById('replyFilePreviewArea').innerHTML = '';
    
    // 显示Aria示例按钮
    document.getElementById('promptButtons').classList.add('hidden');
    document.getElementById('ariaExamples').classList.remove('hidden');
    
    // 如果是音乐模型，可以更新示例按钮（可选）
    if (option.dataset.value === 'Aria-music') {
        updateAriaExamplesForMusic();
    }
}
                });
            });
            
            if (!dropdownGlobalListenerAdded) {
                dropdownGlobalListenerAdded = true;
                document.addEventListener('click', (e) => {
                    // 关闭所有打开的下拉菜单
                    document.querySelectorAll('.dropdown-options.open').forEach(opt => {
                        if (!opt.parentElement.contains(e.target)) {
                            opt.classList.remove('open');
                        }
                    });
                });
            }
        }
        
        function syncModelSelector(targetDropdownId, selectedValue) {
            if (isModelSyncing) return;
            
            const targetDropdown = document.getElementById(targetDropdownId);
            if (!targetDropdown) return;
            
            const targetOptions = targetDropdown.querySelectorAll('.dropdown-option');
            const targetSelected = targetDropdown.querySelector('.dropdown-selected span');
            
            targetOptions.forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value === selectedValue) {
                    opt.classList.add('selected');
                    
                    let displayText = opt.textContent.trim();
                    if (displayText.includes('深度推理搜索')) {
                        displayText = displayText.split('深度推理搜索')[0].trim();
                    } else if (displayText.includes('推理模型')) {
                        displayText = displayText.split('推理模型')[0].trim();
                    } else if (displayText.includes('文生图')) {
                        displayText = displayText.split('文生图')[0].trim();
                    }
                    targetSelected.textContent = displayText;
                }
            });
        }
        
        function updateStyleOptionsForAria(styleDropdownId) {
            const styleDropdown = document.getElementById(styleDropdownId);
            const options = styleDropdown.querySelector('.dropdown-options');
            
            options.innerHTML = `
                <div class="dropdown-option selected" data-value="image">
                    <i class="fas fa-image"></i>生成图片
                </div>
                <div class="dropdown-option" data-value="chinese">
                    <i class="fas fa-mountain"></i>国风图片
                </div>
                <div class="dropdown-option" data-value="realistic">
                    <i class="fas fa-camera"></i>写实图片
                </div>
                <div class="dropdown-option" data-value="anime">
                    <i class="fas fa-star"></i>二次元图片
                </div>
                <div class="dropdown-option" data-value="watercolor">
                    <i class="fas fa-palette"></i>水彩图片
                </div>
            `;
            
            const newOptions = options.querySelectorAll('.dropdown-option');
            newOptions.forEach(option => {
                option.addEventListener('click', () => {
                    newOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    options.classList.remove('open');
                    
                    const styleName = option.textContent.trim();
                    styleDropdown.querySelector('button').setAttribute('title', styleName);
                });
            });
        }
        
        function updateStyleOptionsForText(styleDropdownId) {
            const styleDropdown = document.getElementById(styleDropdownId);
            const options = styleDropdown.querySelector('.dropdown-options');
            
            options.innerHTML = `
                <div class="dropdown-option selected" data-value="normal">
                    <i class="fas fa-comment"></i>正常语气
                </div>
                <div class="dropdown-option" data-value="concise">
                    <i class="fas fa-list"></i>简洁语气
                </div>
                <div class="dropdown-option" data-value="formal">
                    <i class="fas fa-user-tie"></i>正式语气
                </div>
                <div class="dropdown-option" data-value="explanatory">
                    <i class="fas fa-chalkboard-teacher"></i>解释性语气
                </div>
            `;

            if (levelSystem && levelSystem.levelData.level >= 9) {
                options.innerHTML += `
                    <div class="dropdown-option" data-value="tieba">
                        <i class="fas fa-fire"></i>贴吧老哥语气
                    </div>
                `;
            }
            
            const newOptions = options.querySelectorAll('.dropdown-option');
            newOptions.forEach(option => {
                option.addEventListener('click', () => {
                    newOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    options.classList.remove('open');
                    
                    const styleName = option.textContent.trim();
                    styleDropdown.querySelector('button').setAttribute('title', styleName);
                });
            });
        }

        // 添加音乐示例按钮更新函数
function updateAriaExamplesForMusic() {
    const ariaExamples = document.getElementById('ariaExamples');
    ariaExamples.innerHTML = `
        <button class="aria-example-button">
            <i class="fas fa-guitar mr-2"></i> 轻松愉快的吉他音乐
        </button>
        <button class="aria-example-button">
            <i class="fas fa-piano mr-2"></i> 优雅的钢琴曲
        </button>
        <button class="aria-example-button">
            <i class="fas fa-drum mr-2"></i> 激情的鼓点节奏
        </button>
        <button class="aria-example-button">
            <i class="fas fa-headphones mr-2"></i> 电子舞曲风格
        </button>
        <button class="aria-example-button">
            <i class="fas fa-yin-yang mr-2"></i> 宁静的冥想音乐
        </button>
    `;
    
    // 重新绑定点击事件
    document.querySelectorAll('#ariaExamples button').forEach(button => {
        button.addEventListener('click', function() {
            const prompt = this.textContent.trim();
            document.getElementById('userInput').value = prompt;
            document.getElementById('sendButton').click();
        });
    });
}

        // 设置文本区域自动调整大小
        function setupAutoResizeTextarea(textareaId) {
            const textarea = document.getElementById(textareaId);
            if (!textarea) return;
            
            function adjustHeight() {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
            }
            
            textarea.addEventListener('input', adjustHeight);
            textarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.shiftKey) {
                    return;
                } else if (e.key === 'Enter' && !e.shiftKey && this.value.trim() !== '') {
                    e.preventDefault();
                    sendMessage(this);
                }
            });
        }

        // 设置文件上传
        function setupFileUpload() {
            document.getElementById('uploadButton').addEventListener('click', function() {
                document.getElementById('fileInput').click();
            });
            
            document.getElementById('replyUploadButton').addEventListener('click', function() {
                document.getElementById('replyFileInput').click();
            });
            
            document.getElementById('fileInput').addEventListener('change', function(e) {
                handleFileUpload(e, 'main');
            });
            
            document.getElementById('replyFileInput').addEventListener('change', function(e) {
                handleFileUpload(e, 'reply');
            });
        }

        function handleFileUpload(e, target) {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            
            const previewArea = document.getElementById(target === 'main' ? 'filePreviewArea' : 'replyFilePreviewArea');
            previewArea.classList.remove('hidden');
            
            files.forEach(file => {
                const fileObj = fileManager.addFile(target, file);
                
                const filePreview = document.createElement('div');
                filePreview.className = 'file-preview';
                filePreview.dataset.fileId = fileObj.id;
                
                const fileSize = formatFileSize(file.size);
                const fileIcon = getFileIcon(file.type);
                
                let previewContent = '';
                
                if (file.type.startsWith('image/')) {
                    const thumbnailUrl = URL.createObjectURL(file);
                    previewContent = `
                        <img src="${thumbnailUrl}" class="file-thumbnail" alt="Preview">
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${fileSize}</div>
                        </div>
                        <div class="file-remove" data-target="${target}" data-file-id="${fileObj.id}">
                            <i class="fas fa-times"></i>
                        </div>
                    `;
                } else {
                    previewContent = `
                        <div class="file-icon">
                            <i class="${fileIcon}"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${fileSize}</div>
                        </div>
                        <div class="file-remove" data-target="${target}" data-file-id="${fileObj.id}">
                            <i class="fas fa-times"></i>
                        </div>
                    `;
                }
                
                filePreview.innerHTML = previewContent;
                previewArea.appendChild(filePreview);
                
                const removeButton = filePreview.querySelector('.file-remove');
                removeButton.addEventListener('click', function() {
                    const target = this.dataset.target;
                    const fileId = parseInt(this.dataset.fileId);
                    
                    // 释放 Blob URL
                    const thumbnail = filePreview.querySelector('.file-thumbnail');
                    if (thumbnail && thumbnail.src.startsWith('blob:')) {
                        URL.revokeObjectURL(thumbnail.src);
                    }
                    
                    if (fileManager.removeFile(target, fileId)) {
                        this.closest('.file-preview').remove();
                        
                        if (fileManager.getFiles(target).length === 0) {
                            document.getElementById(target === 'main' ? 'filePreviewArea' : 'replyFilePreviewArea').classList.add('hidden');
                        }
                    }
                });
            });
            
            e.target.value = '';
        }
        
        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            else return (bytes / 1048576).toFixed(1) + ' MB';
        }
        
        function getFileIcon(fileType) {
            if (fileType.startsWith('image/')) return 'far fa-file-image';
            else if (fileType.startsWith('video/')) return 'far fa-file-video';
            else if (fileType.startsWith('audio/')) return 'far fa-file-audio';
            else if (fileType.startsWith('text/')) return 'far fa-file-alt';
            else if (fileType.includes('pdf')) return 'far fa-file-pdf';
            else if (fileType.includes('word') || fileType.includes('document')) return 'far fa-file-word';
            else if (fileType.includes('excel') || fileType.includes('sheet')) return 'far fa-file-excel';
            else if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'far fa-file-powerpoint';
            else if (fileType.includes('zip') || fileType.includes('compressed')) return 'far fa-file-archive';
            else return 'far fa-file';
        }

        // 发送消息主函数
        async function sendMessage(input) {
    // 防止重复调用
    if (isSending) {
        console.log('⚠️ 已在发送中，跳过');
        return;
    }
    
    const message = input.value.trim();
    if (!message) {
        console.log('⚠️ 消息为空');
        return;
    }
    
    console.log('🚀 开始发送消息:', message);
    isSending = true;
    
    // 在 try 外面定义 sendButtonId
    const sendButtonId = input.id === 'userInput' ? 'sendButton' : 'replySendButton';
    
    try {
        // 获取选中的样式
        const targetType = input.id === 'userInput' ? 'main' : 'reply';
        const styleDropdownId = targetType === 'main' ? 'styleSelector' : 'replyStyleSelector';
        const style = getSelectedStyle(styleDropdownId);
        
        // 检查是否是AI分析命令
        let actualMessage = message;
        if (window.isAIAnalysis && message === "你眼中的我是什么样的？") {
            // 获取用户信息
            const userNickname = localStorage.getItem('jiorkUserNickname') || '神秘访客';
            const userLevel = levelSystem ? levelSystem.levelData.level : 1;
            const levelTitle = levelSystem ? levelSystem.getLevelTitle(userLevel) : '新手上路';
            
            // 从记忆中提取信息
            let keywords = [];
            let quotes = [];
            let hasMemories = false;
            
            if (memoryManager && memoryManager.memories.length > 0) {
                hasMemories = true;
                
                // 提取关键词
                const keywordSet = new Set();
                memoryManager.memories.forEach(memory => {
                    if (memory.userProfile) {
                        const words = memory.userProfile.split(/[，、,\s]+/)
                            .filter(w => w.length > 1 && w.length < 10);
                        words.forEach(w => keywordSet.add(w));
                    }
                });
                keywords = Array.from(keywordSet).slice(0, 8);
                
                // 提取金句
                quotes = memoryManager.memories
                    .filter(m => m.isQuote && m.quoteValue)
                    .map(m => m.quoteValue)
                    .slice(0, 5);
                
                if (quotes.length < 3) {
                    const additionalQuotes = memoryManager.memories
                        .filter(m => m.message && m.message.length > 20 && m.message.length < 100)
                        .map(m => m.message)
                        .slice(0, 3);
                    quotes = [...quotes, ...additionalQuotes].slice(0, 5);
                }
            }
            
            if (!hasMemories) {
                keywords = ['初来乍到', '充满好奇', '探索者', '学习中', '潜力无限'];
                quotes = ['虽然我们刚刚相遇，但我能感受到你独特的气质'];
            }
            
            const memoryContext = memoryManager.getMemoryContext();
            
            actualMessage = `请为用户生成一份精美的「人格评价卡片」。这是一份来自AI的独特观察报告。

用户信息：
- 昵称：${userNickname}
- 等级：Lv.${userLevel} ${levelTitle}
- 关键特征：${keywords.join('、')}
- 特色发言：${quotes.map(q => `"${q}"`).join('；')}

${hasMemories ? `基于的观察数据：\n${memoryContext}` : '这是一位刚刚开始AI之旅的朋友，充满无限可能。'}

请生成包含以下内容的人格卡片：

1. 【人格画像】用200-300字描述这个人的整体形象，要有画面感和诗意
2. 【独特之处】用150-200字描述AI眼中他最特别的地方
3. 【相处感受】用150-200字描述与他互动的感受
4. 【专属寄语】送给他一句温暖而深刻的话（30字以内）

要求：
- 语言优美、富有情感和想象力
- 使用比喻、拟人等修辞手法
- 像老朋友般亲切自然
- 内容真诚打动人心
- 总字数控制在600-800字

请直接返回内容，不要包含任何格式标记。`;
            
            window.isAIAnalysis = false;
            window.isPersonalityCard = true;
        }
        
        const jorkModel = globalSelectedModel;
        
        // 预检查积分
        if (!pointsSystem.canUsePoints(50)) {
            alert('Insufficient points. Please wait for the next reset cycle or use redemption codes to get more points.');
            isSending = false;
            return;
        }
        
        // 检查成就
        if (achievementSystem && style === 'tieba') {
            achievementSystem.check('hiddenFeature');
        }
        
        // 隐藏初始界面，显示聊天界面
        document.getElementById('initialView').classList.add('hidden');
        document.getElementById('chatView').classList.remove('hidden');
        document.getElementById('bottomInputArea').classList.remove('hidden');
        
        // 获取文件附件
        const fileAttachments = fileManager.getFiles(targetType).map(f => f.file);
        
        // 添加用户消息
        await chatManager.appendUserMessage(message, false, fileAttachments);
        
        // 分析并保存记忆
        memoryManager.addMemory(message).catch(err => {
            console.error('Failed to add memory:', err);
        });
        
        // 首次提问奖励
        if (localStorage.getItem('jiorkGuideCompleted') === 'true') {
            levelSystem.checkFirstQuestionToday();
        }
        
        // 检查成就系统
        if (achievementSystem) {
            if (chatManager.currentMessages.length === 1) {
                achievementSystem.check('firstQuestion');
            }
            achievementSystem.check('question');
            achievementSystem.check('secretPhrase', { message: message });
            achievementSystem.check('modelUsed', { model: jorkModel });
        }
        
        // 清理输入和附件
        input.value = '';
        input.style.height = 'auto';
        fileManager.clearFiles(targetType);
        document.getElementById(input.id === 'userInput' ? 'filePreviewArea' : 'replyFilePreviewArea').classList.add('hidden');
        document.getElementById(input.id === 'userInput' ? 'filePreviewArea' : 'replyFilePreviewArea').innerHTML = '';
        
        // 设置发送按钮为停止状态
        buttonManager.setStopState(sendButtonId);
        
        try {
            // Aria图片生成
            if (jorkModel === 'Aria' || jorkModel === 'Aria-music') {
                if (jorkModel === 'Aria') {
                    const progressContainer = appendMediaGenerationProgress();
                    
                    showMediaGenerationProgress(progressContainer, "正在优化您的提示词...", 5);
                    const optimizedPrompt = await summarizePromptForAria(actualMessage);
                    console.log('Optimized prompt for Aria Image:', optimizedPrompt);
                    
                    const result = await callAriaImageAPI(optimizedPrompt, (status, progress) => {
                        showMediaGenerationProgress(progressContainer, status, progress);
                    }, style);
                    
                    pointsSystem.deductPoints(50);
                    progressContainer.remove();
                    
                    if (result.success) {
                        const finalMessage = `我为您生成了一张图片：\n\n**原始提示：** ${actualMessage}\n\n**优化提示：** ${result.revisedPrompt}`;
                        chatManager.appendAssistantMessage(finalMessage, null, false, true, result.imageUrl);
                    } else {
                        chatManager.appendAssistantMessage(`抱歉，图片生成失败：${result.error}`);
                    }
                } else if (jorkModel === 'Aria-music') {
                    // 音乐生成代码...（保持原样）
                    const progressContainer = appendMusicGenerationProgress();
                    
                    const result = await callAriaMusicAPI(actualMessage, (status, progress) => {
                        showMusicGenerationProgress(progressContainer, status, progress);
                    });
                    
                    pointsSystem.deductPoints(50);
                    progressContainer.remove();
                    
                    if (result.success) {
                        if (result.audioUrl) {
                            let finalMessage = `🎵 **成功生成音乐！**\n\n`;
                            finalMessage += `**音乐描述：** ${actualMessage}\n`;
                            if (result.title && result.title !== "生成的音乐") {
                                finalMessage += `**标题：** ${result.title}\n`;
                            }
                            if (result.duration) {
                                finalMessage += `**时长：** ${Math.floor(result.duration)}秒\n`;
                            }
                            if (result.lyrics && result.lyrics !== actualMessage) {
                                finalMessage += `\n**歌词/描述：**\n${result.lyrics}`;
                            }
                            
                            chatManager.appendAssistantMessage(finalMessage, null, false, false, null, null, true, result.audioUrl);
                        } else if (result.clipId) {
                            const clipMessage = `🎵 **音乐生成任务已提交！**\n\n` +
                                `生成ID: \`${result.clipId}\`\n\n` +
                                `正在为您生成音乐，请稍候...`;
                            
                            chatManager.appendAssistantMessage(clipMessage);
                            
                            setTimeout(async () => {
                                const queryProgressMsg = `⏳ 正在查询音乐生成状态...`;
                                chatManager.appendAssistantMessage(queryProgressMsg);
                                
                                const queryResult = await querySunoClip(result.clipId);
                                
                                if (queryResult.success && queryResult.audioUrl) {
                                    let finalMessage = `🎵 **音乐生成完成！**\n\n`;
                                    if (queryResult.title && queryResult.title !== "生成的音乐") {
                                        finalMessage += `**标题：** ${queryResult.title}\n`;
                                    }
                                    if (queryResult.duration) {
                                        finalMessage += `**时长：** ${Math.floor(queryResult.duration)}秒\n`;
                                    }
                                    if (queryResult.lyrics) {
                                        finalMessage += `\n**歌词/描述：**\n${queryResult.lyrics}`;
                                    }
                                    
                                    chatManager.appendAssistantMessage(finalMessage, null, false, false, null, null, true, queryResult.audioUrl);
                                } else {
                                    chatManager.appendAssistantMessage(
                                        `⚠️ 音乐生成遇到问题或仍在处理中。\n\n` +
                                        `您可以稍后使用生成ID查询：${result.clipId}`
                                    );
                                }
                            }, 10000);
                        } else {
                            chatManager.appendAssistantMessage(`音乐生成遇到问题，请重试。`);
                        }
                    } else {
                        chatManager.appendAssistantMessage(
                            `抱歉，音乐生成失败：${result.error}\n\n` +
                            `请检查您的描述是否清晰，或稍后再试。`
                        );
                    }
                }
            } else {
                // 文本生成
                if (window.isPersonalityCard) {
                    const chatView = document.getElementById('chatView');
                    const loadingContainer = document.createElement('div');
                    loadingContainer.id = 'personalityCardLoading';
                    loadingContainer.className = 'personality-card-loading';
                    loadingContainer.innerHTML = `
                        <div class="loading-text">
                            <i class="fas fa-magic loading-spinner"></i>
                            <span>AI正在分析您的人格特征...</span>
                        </div>
                    `;
                    chatView.appendChild(loadingContainer);
                    
                    const timeoutId = setTimeout(() => {
                        const loadingEl = document.getElementById('personalityCardLoading');
                        if (loadingEl && loadingEl.parentNode) {
                            loadingEl.innerHTML = `
                                <div class="text-center p-4">
                                    <i class="fas fa-exclamation-triangle text-red-500 text-2xl mb-2"></i>
                                    <p class="text-red-500 mb-3">人格分析响应超时</p>
                                    <button onclick="location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded">
                                        刷新重试
                                    </button>
                                </div>
                            `;
                        }
                        window.isPersonalityCard = false;
                    }, 60000);
                    
                    window.personalityCardTimeout = timeoutId;
                    
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                // 显示流式响应
                appendStreamingResponse();
                
                const response = await callJorkAPI(
                    actualMessage, 
                    jorkModel,
                    chatManager.currentMessages,
                    style,
                    fileAttachments
                );
                
                // 成功后扣除积分
                pointsSystem.deductPoints(50);
                
                if (response.error) {
                    const responseContent = document.getElementById('responseContent');
                    if (responseContent) {
                        showErrorMessage(response.error, responseContent.parentNode, () => {
                            sendMessage(input);
                        });
                    }
                    finalizeStreamingResponse('API调用失败，请查看错误信息并重试。');
                    return;
                }
                
                if (window.personalityCardTimeout) {
                    clearTimeout(window.personalityCardTimeout);
                    window.personalityCardTimeout = null;
                }
                
                if (response.aborted) {
                    finalizeStreamingResponse(response.content + "\n\n*生成已停止*", null, response.searchSteps);
                } else {
                    finalizeStreamingResponse(response.content, response.thinking, response.searchSteps);
                }
                
                if (achievementSystem && response.content && response.content.length > 1000) {
                    achievementSystem.check('responseLength', { length: response.content.length });
                }
            }
            
            buttonManager.restoreButton(sendButtonId);
            
        } catch (error) {
            // 失败时退还积分
            pointsSystem.refundPoints(50);
            
            buttonManager.restoreButton(sendButtonId);
            
            const progressEl = document.getElementById('imageGenerationProgress');
            if (progressEl && progressEl.parentNode) {
                progressEl.remove();
            }
            
            console.error('Error calling API:', error);
            finalizeStreamingResponse(`抱歉，发生了错误：${error.message || '无法连接到服务'}`);
        }
    } catch (error) {
        console.error('发送消息主流程错误:', error);
        buttonManager.restoreButton(sendButtonId);
        isSending = false;
    } finally {
        isSending = false;
        buttonManager.restoreButton(sendButtonId);
        console.log('✅ 发送完成');
    }
}

        // Canvas交互功能
        function setupCanvasInteraction() {
            const canvasContainer = document.getElementById('canvasContainer');
            const canvasIframe = document.getElementById('canvasIframe');
            const canvasEditor = document.getElementById('canvasEditor');
            const closeCanvasButton = document.getElementById('closeCanvasButton');
            const toggleEditorButton = document.getElementById('toggleEditorButton');
            const runCodeButton = document.getElementById('runCodeButton');
            const updateCodeButton = document.getElementById('updateCodeButton');
            const newTabButton = document.getElementById('newTabButton');
            
            closeCanvasButton.addEventListener('click', () => {
                canvasContainer.classList.remove('active');
                canvasIsActive = false;
            });
            
            toggleEditorButton.addEventListener('click', () => {
                if (canvasEditor.style.display === 'block') {
                    canvasEditor.style.display = 'none';
                    canvasIframe.style.height = '100%';
                } else {
                    canvasEditor.style.display = 'block';
                    canvasIframe.style.height = '60%';
                    canvasEditor.textContent = currentCanvasCode;
                }
            });
            
            runCodeButton.addEventListener('click', () => {
                if (canvasEditor.style.display === 'block') {
                    currentCanvasCode = canvasEditor.innerText;
                }
                updateCanvasFrame(currentCanvasCode);
            });
            
            updateCodeButton.addEventListener('click', () => {
                if (canvasEditor.style.display === 'block') {
                    currentCanvasCode = canvasEditor.innerText;
                    updateCanvasFrame(currentCanvasCode);
                }
            });
            
            newTabButton.addEventListener('click', () => {
                const newTab = window.open('', '_blank');
                newTab.document.write(currentCanvasCode);
                newTab.document.close();
            });
        }

        function updateCanvasFrame(code) {
            const canvasIframe = document.getElementById('canvasIframe');
            const frameDoc = canvasIframe.contentDocument || canvasIframe.contentWindow.document;
            
            frameDoc.open();
            frameDoc.write(code);
            frameDoc.close();
        }
        function showMusicGenerationProgress(progressContainer, statusText, progressPercent = 0) {
    progressContainer.innerHTML = `
        <div class="progress-header">
            <i class="fas fa-music progress-icon"></i>
            Aria-Music正在生成音乐...
        </div>
        <div class="progress-text">${statusText}</div>
        <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
        </div>
    `;
}

function appendMusicGenerationProgress() {
    const chatView = document.getElementById('chatView');
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'image-generation-progress mb-4';
    progressContainer.id = 'musicGenerationProgress';
    
    chatView.appendChild(progressContainer);
    
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return progressContainer;
}
        
        // 图片查看器功能
        function setupImageViewer() {
            const imageViewerContainer = document.getElementById('imageViewerContainer');
            const imageViewerImage = document.getElementById('imageViewerImage');
            const imageViewerVideo = document.getElementById('imageViewerVideo');
            const closeImageViewerButton = document.getElementById('closeImageViewerButton');
            const openImageNewTabButton = document.getElementById('openImageNewTabButton');
            const downloadImageButton = document.getElementById('downloadImageButton');
            
            closeImageViewerButton.addEventListener('click', () => {
                imageViewerContainer.classList.remove('active');
                imageViewerImage.style.display = 'none';
                imageViewerVideo.style.display = 'none';
            });
            
            openImageNewTabButton.addEventListener('click', () => {
                const imageUrl = imageViewerImage.src;
                const videoUrl = imageViewerVideo.src;
                const url = imageUrl || videoUrl;
                if (url) {
                    window.open(url, '_blank');
                }
            });
            
            downloadImageButton.addEventListener('click', () => {
                const imageUrl = imageViewerImage.src;
                const videoUrl = imageViewerVideo.src;
                const url = imageUrl || videoUrl;
                if (url) {
                    const link = document.createElement('a');
                    link.href = url;
                    const isVideo = url.includes('.mp4') || url.includes('video');
                    link.download = isVideo ? 'generated-video.mp4' : 'generated-image.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
        }

        // 初始化
        // 用户信息管理
        function initUserInfo() {
            // 获取保存的昵称
            const savedNickname = localStorage.getItem('jiorkUserNickname') || '用户';
            document.getElementById('userNickname').textContent = savedNickname;
            document.getElementById('nicknameInput').value = savedNickname;
            
            // 获取保存的头像URL
            const savedAvatarUrl = localStorage.getItem('jiorkUserAvatarUrl') || 'https://www.jorkai.cn/用户默认头像';
            document.getElementById('avatarUrlInput').value = savedAvatarUrl;
            updateUserAvatar(savedAvatarUrl);
            
            // 更新计划状态显示
            const isPro = membershipSystem.checkMembership();
            document.getElementById('userPlan').textContent = isPro ? 'Pro Plan' : 'Free Plan';
            
            // 设置当前语言选中状态
            const currentLang = 'zh'; // 当前是中文版
            document.querySelectorAll('.language-option').forEach(option => {
                if (option.dataset.lang === currentLang) {
                    option.classList.add('selected');
                }
            });
        }

        // 从 Supabase 加载用户数据
async function loadUserData() {
    try {
        // 加载用户基本信息
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUserId)
            .single();
        
        if (userData) {
            // 更新本地存储和UI
            localStorage.setItem('jiorkUserNickname', userData.nickname || '用户');
            localStorage.setItem('jiorkUserAvatarUrl', userData.avatar_url || 'https://www.jorkai.cn/用户默认头像');
            
            // 更新UI显示
            document.getElementById('userNickname').textContent = userData.nickname || '用户';
            document.getElementById('nicknameInput').value = userData.nickname || '';
            document.getElementById('avatarUrlInput').value = userData.avatar_url || '';
            updateUserAvatar(userData.avatar_url);
            
            // 更新会员状态
            if (userData.plan === 'pro') {
                membershipSystem.activateMembership('SUPABASE-PRO-' + currentUserId);
            }
        }
        
        // 加载用户统计数据
        const { data: statsData } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', currentUserId)
            .single();
        
        if (statsData) {
            // 更新等级系统
            levelSystem.levelData = {
                level: statsData.level,
                exp: statsData.exp,
                totalExp: statsData.total_exp,
                lastCheckin: statsData.last_checkin,
                streakDays: statsData.streak_days
            };
            levelSystem.updateLevelUI();
            
            // 更新积分
            pointsSystem.initializeFromSupabase(statsData);
        }
        
        // 加载聊天历史
        await loadChatHistory();
        
        // 加载AI记忆
        await loadMemories();
        
        // 加载成就
        await loadAchievements();
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

        // 更新用户头像
        function updateUserAvatar(url) {
            const avatarEl = document.getElementById('userAvatar');
            
            // 创建一个新的图片对象来测试URL是否有效
            const img = new Image();
            img.onload = function() {
                // URL有效，显示图片
                avatarEl.innerHTML = `<img src="${url}" alt="用户头像" style="width: 100%; height: 100%; object-fit: cover;">`;
            };
            img.onerror = function() {
                // URL无效，显示文字
                avatarEl.innerHTML = 'URL无效';
                avatarEl.style.fontSize = '10px';
            };
            img.src = url;
        }

        // 用户信息面板点击事件
        document.getElementById('userInfoPanel').addEventListener('click', function() {
            document.getElementById('userInfoModal').classList.remove('hidden');
        });

        // 关闭用户信息模态框
        document.getElementById('closeUserModalBtn').addEventListener('click', function() {
            document.getElementById('userInfoModal').classList.add('hidden');
        });

        // 保存昵称
// 示例：保存昵称时的错误处理
document.getElementById('saveNicknameBtn').addEventListener('click', async function() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .update({ nickname: nickname })
            .eq('id', currentUserId);
        
        if (error) throw error;
        
        // 更新本地存储
        localStorage.setItem('jiorkUserNickname', nickname);
        document.getElementById('userNickname').textContent = nickname;
        
        // 显示成功
        this.textContent = 'Saved';
        this.classList.add('bg-green-200', 'text-green-600');
    } catch (error) {
        console.error('Error saving nickname:', error);
        this.textContent = 'Save failed';
        this.classList.add('bg-red-200', 'text-red-600');
        
        // 显示错误信息
        alert(`Save failed: ${error.message}`);
    } finally {
        setTimeout(() => {
            this.textContent = '保存昵称';
            this.className = 'mt-2 px-4 py-2 bg-orange-200 text-orange-600 rounded-md hover:bg-orange-300 transition-colors';
        }, 1500);
    }
});

        // 保存头像URL
document.getElementById('saveAvatarBtn').addEventListener('click', async function() {
    const avatarUrl = document.getElementById('avatarUrlInput').value.trim();
    if (avatarUrl) {
        // 保存到本地
        localStorage.setItem('jiorkUserAvatarUrl', avatarUrl);
        updateUserAvatar(avatarUrl);
        
        // 保存到 Supabase
        try {
            await supabaseClient
                .from('users')
                .update({ avatar_url: avatarUrl })
                .eq('id', currentUserId);
            
            this.textContent = 'Saved';
            this.classList.add('bg-green-200', 'text-green-600');
        } catch (error) {
            console.error('Error saving avatar:', error);
            this.textContent = 'Save failed';
        }
        
        setTimeout(() => {
            this.textContent = '保存头像';
            this.classList.remove('bg-green-200', 'text-green-600');
        }, 1500);
    }
});

        // 语言切换
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', function() {
                const targetUrl = this.dataset.url;
                if (targetUrl && !this.classList.contains('selected')) {
                    // 保存当前的聊天记录等数据
                    localStorage.setItem('jiorkLanguageSwitch', 'true');
                    window.location.href = targetUrl;
                }
            });
        });

        // 删除所有对话
        document.getElementById('deleteAllChatsBtn').addEventListener('click', function() {
            if (confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
                // 删除聊天历史
                chatManager.chatHistory = [];
                chatManager.currentChatId = null;
                chatManager.currentMessages = [];
                chatManager.saveChatHistory();
                chatManager.updateChatHistorySidebar();
                
                // 返回初始界面
                document.getElementById('initialView').classList.remove('hidden');
                document.getElementById('chatView').classList.add('hidden');
                document.getElementById('bottomInputArea').classList.add('hidden');
                document.getElementById('currentChatTitle').classList.add('hidden');
                document.getElementById('chatView').innerHTML = '';
                
                // 关闭模态框
                document.getElementById('userInfoModal').classList.add('hidden');
                
                // 显示删除成功提示
                this.textContent = 'Deleted';
                this.classList.add('danger-button');
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>删除所有对话';
                    this.classList.remove('danger-button');
                }, 2000);
            }
        });

        // 记忆功能开关
        document.getElementById('memoryToggle').addEventListener('change', function() {
            memoryManager.toggleEnabled();
        });

        // 清除所有记忆
        document.getElementById('clearAllMemoriesBtn').addEventListener('click', function() {
            if (confirm('Are you sure you want to clear all AI memories? This action cannot be undone.')) {
                memoryManager.clearAllMemories();
                
                this.textContent = 'Cleared';
                this.classList.add('bg-green-200', 'text-green-600');
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-eraser mr-2"></i>清除所有记忆';
                    this.classList.remove('bg-green-200', 'text-green-600');
                    this.classList.add('bg-purple-100', 'text-purple-600');
                }, 1500);
            }
        });

        // 取消登录
document.getElementById('logoutBtn').addEventListener('click', async function() {
    if (confirm('Are you sure you want to log out?')) {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            
            // 清除本地数据（可选）
            // localStorage.clear();
            
            // 跳转到登录页面
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Logout failed, please try again');
        }
    }
});

        // 深色模式切换
        document.getElementById('darkModeToggle').addEventListener('click', function() {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
        });

        // 初始化深色模式
        if (localStorage.getItem('darkMode') === 'true') {
            document.documentElement.classList.add('dark');
        }

        // 初始化用户信息 （注释）
        //initUserInfo();

        updateTimeGreeting();
        setInterval(updateTimeGreeting, 300000); // 每5分钟更新一次

        setupDropdown('modelSelector');
        setupDropdown('replyModelSelector');
        setupDropdown('styleSelector');
        setupDropdown('replyStyleSelector');
        
        setupAutoResizeTextarea('userInput');
        setupAutoResizeTextarea('replyInput');
        
        setupFileUpload();
        setupCanvasInteraction();
        setupImageViewer();
        
        // 初始化记忆UI
        memoryManager.updateMemoryUI();

        // 发送按钮事件
        document.getElementById('sendButton').addEventListener('click', function() {
            sendMessage(document.getElementById('userInput'));
        });
        
        document.getElementById('replySendButton').addEventListener('click', function() {
            sendMessage(document.getElementById('replyInput'));
        });

        // 分类按钮点击事件
        document.querySelectorAll('#promptButtons button').forEach(button => {
            button.addEventListener('click', function() {
                const category = this.textContent.trim();
                let prompt = "";
                let forceModel = null;
                
                if (category.includes('写作助手')) {
                    prompt = "我需要一些写作方面的帮助，可以给我一些写作技巧和建议吗？";
                } else if (category.includes('学习辅导')) {
                    prompt = "我想学习一个新技能，有什么高效的学习方法和策略？";
                } else if (category.includes('编程开发')) {
                    prompt = "我是编程初学者，应该从哪种编程语言开始学习？请给我一个学习路线图。";
                } else if (category.includes('深度搜索')) {
                    prompt = "请帮我深度搜索并分析人工智能技术的最新发展趋势。";
                    forceModel = 'Jork-Epist-4'; // 自动使用深度搜索模型
                } else if (category.includes('AI眼中的你')) {
                    prompt = "你眼中的我是什么样的？";
                    // 设置一个标记，表示这是特殊命令
                    window.isAIAnalysis = true;
                }
                
                // 如果需要强制使用特定模型
                if (forceModel) {
                    // 临时更改模型
                    globalSelectedModel = forceModel;
                    // 更新UI显示
                    const modelSelector = document.getElementById('modelSelector');
                    const selectedOption = modelSelector.querySelector(`[data-value="${forceModel}"]`);
                    if (selectedOption) {
                        modelSelector.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));
                        selectedOption.classList.add('selected');
                        let displayText = selectedOption.textContent.trim();
                        if (displayText.includes('深度推理搜索')) {
                            displayText = displayText.split('深度推理搜索')[0].trim();
                        }
                        modelSelector.querySelector('.dropdown-selected span').textContent = displayText;
                    }
                }
                
                document.getElementById('userInput').value = prompt;
                document.getElementById('sendButton').click();
            });
        });

        // Aria示例按钮点击事件
        document.querySelectorAll('#ariaExamples button').forEach(button => {
            button.addEventListener('click', function() {
                const prompt = this.textContent.trim();
                document.getElementById('userInput').value = prompt;
                document.getElementById('sendButton').click();
            });
        });

        // 新建聊天按钮
        document.getElementById('newChatBtn').addEventListener('click', function() {
            chatManager.startNewChat();
            
            document.getElementById('initialView').classList.remove('hidden');
            document.getElementById('chatView').classList.add('hidden');
            document.getElementById('bottomInputArea').classList.add('hidden');
            document.getElementById('chatView').innerHTML = '';
            toggleSidebar(false);  // ← 改为这行
            document.getElementById('currentChatTitle').classList.add('hidden');
            
            requestManager.abortAllRequests();
            buttonManager.restoreAllButtons();
        });
        
        // 侧边栏状态管理
let sidebarState = {
    isOpen: false,
    isAnimating: false
};

// 侧边栏切换函数
function toggleSidebar(forceState = null) {
    if (sidebarState.isAnimating) return;
    
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');
    const currentChatTitle = document.getElementById('currentChatTitle');
    
    // 确定目标状态
    const targetState = forceState !== null ? forceState : !sidebarState.isOpen;
    
    if (targetState === sidebarState.isOpen) return;
    
    sidebarState.isAnimating = true;
    sidebarState.isOpen = targetState;
    
    if (targetState) {
        // 打开侧边栏
        sidebar.classList.remove('hidden');
        sidebar.classList.add('active');
        sidebarToggle.classList.add('active');
        
        // 桌面端添加推拉效果
        if (window.innerWidth > 768) {
            mainContent.classList.add('sidebar-open');
        }
        
        // 隐藏聊天标题
        if (currentChatTitle) {
            currentChatTitle.classList.add('hidden');
        }
        
        // 添加图标变化动画
        const icon = sidebarToggle.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-times'; // 改为关闭图标
        }
        
    } else {
        // 关闭侧边栏
        sidebar.classList.remove('active');
        sidebarToggle.classList.remove('active');
        mainContent.classList.remove('sidebar-open');
        
        // 恢复图标
        const icon = sidebarToggle.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-bars'; // 恢复为菜单图标
        }
        
        // 显示聊天标题（如果在聊天中）
        if (currentChatTitle && !document.getElementById('chatView').classList.contains('hidden')) {
            currentChatTitle.classList.remove('hidden');
        }
    }
    
    // 动画完成后重置状态
    setTimeout(() => {
        sidebarState.isAnimating = false;
    }, 400);
}

// 侧边栏切换按钮事件
document.getElementById('sidebarToggle').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleSidebar();
});

// 侧边栏关闭按钮事件
document.getElementById('closeBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleSidebar(false);
});

// 点击遮罩关闭侧边栏（移动端）
document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768 && sidebarState.isOpen) {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
            toggleSidebar(false);
        }
    }
});

// 响应式处理
window.addEventListener('resize', function() {
    const mainContent = document.getElementById('mainContent');
    
    if (window.innerWidth <= 768) {
        // 移动端：移除推拉效果
        mainContent.classList.remove('sidebar-open');
    } else if (sidebarState.isOpen) {
        // 桌面端：如果侧边栏开启，添加推拉效果
        mainContent.classList.add('sidebar-open');
    }
});

// ESC键关闭侧边栏
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sidebarState.isOpen) {
        toggleSidebar(false);
    }
});

        // 积分相关模态框
        document.getElementById('addPointsBtn').addEventListener('click', function() {
            const redemptionModal = document.getElementById('redemptionModal');
            redemptionModal.classList.remove('hidden');
            document.getElementById('redemptionCodeInput').focus();
        });
        
        document.getElementById('closeModalBtn').addEventListener('click', function() {
            document.getElementById('redemptionModal').classList.add('hidden');
            document.getElementById('redemptionResult').classList.add('hidden');
            document.getElementById('redemptionCodeInput').value = '';
        });
        
        document.getElementById('cancelRedemptionBtn').addEventListener('click', function() {
            document.getElementById('redemptionModal').classList.add('hidden');
            document.getElementById('redemptionResult').classList.add('hidden');
            document.getElementById('redemptionCodeInput').value = '';
        });
        
        document.getElementById('redeemCodeBtn').addEventListener('click', function() {
            const codeInput = document.getElementById('redemptionCodeInput');
            const code = codeInput.value.trim();
            const resultEl = document.getElementById('redemptionResult');
            
            if (!code) {
                resultEl.textContent = "请输入兑换码";
                resultEl.className = "mt-3 text-center text-red-500";
                resultEl.classList.remove('hidden');
                return;
            }
            
            const result = pointsSystem.redeemCode(code);
            
            resultEl.textContent = result.message;
            resultEl.className = `mt-3 text-center ${result.success ? 'text-green-500' : 'text-red-500'}`;
            resultEl.classList.remove('hidden');
            
            if (result.success) {
                setTimeout(() => {
                    document.getElementById('redemptionModal').classList.add('hidden');
                    resultEl.classList.add('hidden');
                    codeInput.value = '';
                }, 2000);
            }
        });
        
        // 会员模态框
        document.getElementById('closeMembershipModalBtn').addEventListener('click', function() {
            document.getElementById('membershipModal').classList.add('hidden');
            document.getElementById('membershipResult').classList.add('hidden');
            document.getElementById('membershipCodeInput').value = '';
        });
        
        document.getElementById('cancelMembershipBtn').addEventListener('click', function() {
            document.getElementById('membershipModal').classList.add('hidden');
            document.getElementById('membershipResult').classList.add('hidden');
            document.getElementById('membershipCodeInput').value = '';
        });
        
        document.getElementById('upgradeMembershipBtn').addEventListener('click', function() {
            const codeInput = document.getElementById('membershipCodeInput');
            const code = codeInput.value.trim();
            const resultEl = document.getElementById('membershipResult');
            
            if (!code) {
                resultEl.textContent = "请输入会员兑换码";
                resultEl.className = "mt-3 text-center text-red-500";
                resultEl.classList.remove('hidden');
                return;
            }
            
            const result = membershipSystem.activateMembership(code);
            
            resultEl.textContent = result.message;
            resultEl.className = `mt-3 text-center ${result.success ? 'text-green-500' : 'text-red-500'}`;
            resultEl.classList.remove('hidden');
            
            if (result.success) {
                setTimeout(() => {
                    document.getElementById('membershipModal').classList.add('hidden');
                    resultEl.classList.add('hidden');
                    codeInput.value = '';
                }, 2000);
            }
        });

// 导出人格卡片为图片 - 挂载到全局window对象
window.exportPersonalityCard = async function(cardId) {
    const cardEl = document.getElementById(cardId + '_card');
    if (!cardEl) return;
    
    // 显示水印
    cardEl.classList.add('exporting');
    
    try {
        // 使用 html2canvas 生成图片
        const canvas = await html2canvas(cardEl, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
            width: cardEl.offsetWidth,
            height: cardEl.offsetHeight
        });
        
        // 转换为图片并下载
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `JorkAI_人格卡_${new Date().getTime()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.95);
        
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败，请重试');
    } finally {
        // 隐藏水印
        cardEl.classList.remove('exporting');
    }
}
// ========== StreamProcessor 修复补丁 ==========
// 修复 StreamProcessor 的 processChunk 方法
StreamProcessor.prototype.processChunk = function(chunk) {
    console.log('[StreamProcessor] 收到数据块:', chunk.substring(0, 100));
    
    this.buffer += chunk;
    let lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            
            if (dataStr === '[DONE]') {
                console.log('[StreamProcessor] 流结束');
                continue;
            }
            
            try {
                const parsedData = JSON.parse(dataStr);
                
                // 从 choices[0].delta.content 获取内容
                const content = parsedData.choices?.[0]?.delta?.content;
                
                if (content) {
                    console.log('[StreamProcessor] 提取到内容:', content);
                    this.fullResponse += content;
                    
                    // 立即更新DOM
                    const responseContent = document.getElementById('responseContent');
                    if (responseContent) {
                        responseContent.innerHTML = marked.parse(this.fullResponse);
                        console.log('[StreamProcessor] DOM已更新');
                    } else {
                        console.error('[StreamProcessor] responseContent元素不存在！');
                    }
                }
            } catch (e) {
                console.error('[StreamProcessor] 解析错误:', e);
            }
        }
    }
};

// 修复 appendStreamingResponse 函数
window.appendStreamingResponse = function() {
    console.log('[appendStreamingResponse] 开始创建容器');
    
    const chatView = document.getElementById('chatView');
    if (!chatView) {
        console.error('[appendStreamingResponse] chatView不存在！');
        // 如果chatView不存在，创建它
        const chatContainer = document.querySelector('#chatContainer .max-w-4xl');
        if (chatContainer) {
            const newChatView = document.createElement('div');
            newChatView.id = 'chatView';
            newChatView.className = '';
            chatContainer.appendChild(newChatView);
            console.log('[appendStreamingResponse] 创建了新的chatView');
        }
        return null;
    }
    
    // 移除旧的流式响应容器
    const existing = document.getElementById('streamingResponse');
    if (existing) {
        console.log('[appendStreamingResponse] 移除旧容器');
        existing.remove();
    }
    
    // 创建新容器
    const container = document.createElement('div');
    container.id = 'streamingResponse';
    container.className = 'mb-8';
    
    const content = document.createElement('div');
    content.id = 'responseContent';
    content.className = 'markdown-content';
    content.innerHTML = '<div class="ai-typing"></div>';
    
    container.appendChild(content);
    chatView.appendChild(container);
    
    console.log('[appendStreamingResponse] ✅ 容器创建成功');
    
    // 滚动到底部
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    return content;
};

console.log('✅ StreamProcessor 和 appendStreamingResponse 修复补丁已应用');
// ========== 修复补丁结束 ==========

// 全局错误处理
window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('JWT')) {
        // Token 过期，重新登录
        window.location.href = '/login.html';
    }
});
