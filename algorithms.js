
class Algorithm {
    constructor(gridSize, config = {}) {
        this.gridSize = gridSize;
        this.config = {
            learningRate: 0.1,
            discountFactor: 0.9,
            explorationRate: 0.2,
            explorationStrategy: 'epsilon-greedy',
            ...config
        };
        this.actions = ['up', 'down', 'left', 'right'];
        this.initializeTables(gridSize);
    }

    getBestActions(state, takeActionFunc = null, agentPos = null) {
        throw new Error('getBestActions must be implemented by subclass');
    }

    calculateSoftmaxProbabilities(values, beta = null) {
        const numActions = values.length;
        if (numActions === 0) return {};

        const maxVal = Math.max(...values);
        const expValues = values.map(v => Math.exp(effectiveBeta * (v - maxVal)));
        const sumExpValues = expValues.reduce((sum, val) => sum + val, 0);

        const probabilities = {};
        if (sumExpValues === 0 || !isFinite(sumExpValues)) {
            const uniformProb = 1.0 / numActions;
            this.actions.forEach(action => probabilities[action] = uniformProb);
        } else {
            const calculatedProbs = expValues.map(expVal => expVal / sumExpValues);
            this.actions.forEach((action, index) => {
                probabilities[action] = calculatedProbs[index];
            });
        }
        return probabilities;
    }

    chooseRandomAction() {
        return this.actions[Math.floor(Math.random() * this.actions.length)];
    }

    chooseGreedyAction(state, takeActionFunc = null, agentPos = null) {
        const bestActions = this.getBestActions(state, takeActionFunc, agentPos);
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    getActionProbabilities(state, takeActionFunc = null, agentPos = null) {
        const numActions = this.actions.length;
        if (numActions === 0) return {};

        let probabilities = {};
        const strategy = this.config.explorationStrategy;

        if (strategy === 'epsilon-greedy') {
            const bestActions = this.getBestActions(state, takeActionFunc, agentPos);
            const numBestActions = bestActions.length;
            const greedyProb = (1.0 - this.config.explorationRate);
            const exploreProb = this.config.explorationRate / numActions;

            this.actions.forEach(action => {
                if (bestActions.includes(action)) {
                    probabilities[action] = (greedyProb / numBestActions) + exploreProb;
                } else {
                    probabilities[action] = exploreProb;
                }
            });
        } else if (strategy === 'random') {
            const uniformProb = 1.0 / numActions;
            this.actions.forEach(action => probabilities[action] = uniformProb);
        } else if (strategy === 'greedy') {
            const bestActions = this.getBestActions(state, takeActionFunc, agentPos);
            const numBestActions = bestActions.length;
            const bestActionProb = 1.0 / numBestActions;
            this.actions.forEach(action => {
                probabilities[action] = bestActions.includes(action) ? bestActionProb : 0;
            });
        }

        return probabilities;
    }

    getActionValue(state, action, takeActionFunc = null, agentPos = null) {
        return 0;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

class QLearningAlgorithm extends Algorithm {
    constructor(gridSize, config = {}) {
        super(gridSize, config);
    }

    initializeTables(gridSize) {
        this.qTable = {};
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const state = `${x},${y}`;
                this.qTable[state] = {};
                for (const action of this.actions) {
                    this.qTable[state][action] = 0;
                }
            }
        }
    }

    ensureStateInitialized(state) {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
            for (const action of this.actions) {
                this.qTable[state][action] = 0;
            }
        }
    }

    getActionValue(state, action) {
        this.ensureStateInitialized(state);
        return this.qTable[state][action];
    }

    getBestActions(state) {
        this.ensureStateInitialized(state);
        let maxValue = -Infinity;
        let bestActions = [];

        for (const action of this.actions) {
            const qValue = this.qTable[state][action];
            if (qValue > maxValue) {
                maxValue = qValue;
                bestActions = [action];
            } else if (qValue === maxValue) {
                bestActions.push(action);
            }
        }

        return bestActions.length > 0 ? bestActions : this.actions;
    }

    getValue(state) {
        this.ensureStateInitialized(state);
        let maxQ = -Infinity;
        for (const action of this.actions) {
            if (this.qTable[state][action] > maxQ) {
                maxQ = this.qTable[state][action];
            }
        }
        return maxQ === -Infinity ? 0 : maxQ;
    }

    chooseAction(state) {
        this.ensureStateInitialized(state);
        const strategy = this.config.explorationStrategy;

        if (strategy === 'epsilon-greedy') {
            if (Math.random() < this.config.explorationRate) {
                return this.chooseRandomAction();
            } else {
                return this.chooseGreedyAction(state);
            }
        } else if (strategy === 'softmax') {
            const qValues = this.actions.map(action => this.qTable[state][action]);
            const probabilities = this.calculateSoftmaxProbabilities(qValues);
            
            let cumulativeProb = 0;
            const randomSample = Math.random();
            for (let i = 0; i < this.actions.length; i++) {
                cumulativeProb += probabilities[this.actions[i]];
                if (randomSample < cumulativeProb) {
                    return this.actions[i];
                }
            }
            return this.actions[this.actions.length - 1];
        } else if (strategy === 'random') {
            return this.chooseRandomAction();
        } else if (strategy === 'greedy') {
            return this.chooseGreedyAction(state);
        }

        return this.chooseGreedyAction(state);
    }

    learningStep(currentState, action, reward, nextState, done) {
        this.ensureStateInitialized(currentState);
        this.ensureStateInitialized(nextState);

        const oldQValue = this.qTable[currentState][action];
        const bestNextActions = this.getBestActions(nextState);
        const maxNextQ = this.qTable[nextState][bestNextActions[0]];
        const tdTarget = reward + this.config.discountFactor * maxNextQ;
        const newQValue = oldQValue + this.config.learningRate * (tdTarget - oldQValue);
        
        this.qTable[currentState][action] = newQValue;
        return { needsStop: false };
    }
}

class SarsaAlgorithm extends QLearningAlgorithm {
    learningStep(currentState, action, reward, nextState, done) {
        this.ensureStateInitialized(currentState);
        this.ensureStateInitialized(nextState);

        const oldQValue = this.qTable[currentState][action];
        const nextAction = this.chooseAction(nextState);
        const nextQ = this.qTable[nextState][nextAction];
        const tdTarget = reward + this.config.discountFactor * nextQ;
        const newQValue = oldQValue + this.config.learningRate * (tdTarget - oldQValue);
        
        this.qTable[currentState][action] = newQValue;
        return { needsStop: false };
    }
}

class MonteCarloAlgorithm extends QLearningAlgorithm {
    constructor(gridSize, config = {}) {
        super(gridSize, config);
        this.currentEpisodeTrajectory = [];
    }

    learningStep(currentState, action, reward, nextState, done) {
        this.currentEpisodeTrajectory.push({ 
            state: currentState, 
            action: action, 
            reward: reward 
        });
        return { needsStop: false };
    }

    applyEpisodeUpdates() {
        let G = 0;
        for (let i = this.currentEpisodeTrajectory.length - 1; i >= 0; i--) {
            const { state, action, reward } = this.currentEpisodeTrajectory[i];
            G = reward + this.config.discountFactor * G;
            
            const oldQValue = this.qTable[state][action];
            const newQValue = oldQValue + this.config.learningRate * (G - oldQValue);
            this.qTable[state][action] = newQValue;
        }
        this.currentEpisodeTrajectory = [];
    }
}

class AlgorithmFactory {
    static create(algorithmType, gridSize, config = {}) {
        const algorithms = {
            'q-learning': QLearningAlgorithm,
            'sarsa': SarsaAlgorithm,
            'monte-carlo': MonteCarloAlgorithm
        };

        const AlgorithmClass = algorithms[algorithmType];
        if (!AlgorithmClass) {
            throw new Error(`Unknown algorithm type: ${algorithmType}`);
        }

        return new AlgorithmClass(gridSize, config);
    }
}

class AlgorithmManager {
    constructor(initialAlgorithm, gridSize, config = {}) {
        this.currentAlgorithm = AlgorithmFactory.create(initialAlgorithm, gridSize, config);
        this.algorithmType = initialAlgorithm;
        this.gridSize = gridSize;
        this.baseConfig = config;
    }

    switchAlgorithm(newAlgorithmType, newConfig = {}) {
        const config = { ...this.baseConfig, ...newConfig };
        this.currentAlgorithm = AlgorithmFactory.create(newAlgorithmType, this.gridSize, config);
        this.algorithmType = newAlgorithmType;
    }

    updateGridSize(newGridSize) {
        this.gridSize = newGridSize;
        const config = this.currentAlgorithm.config;
        this.currentAlgorithm = AlgorithmFactory.create(this.algorithmType, newGridSize, config);
    }

    chooseAction(state, takeActionFunc = null, agentPos = null) {
        return this.currentAlgorithm.chooseAction(state, takeActionFunc, agentPos);
    }

    learningStep(currentState, action, reward, nextState, done, takeActionFunc = null, agentPos = null) {
        return this.currentAlgorithm.learningStep(currentState, action, reward, nextState, done, takeActionFunc, agentPos);
    }

    getBestActions(state, takeActionFunc = null, agentPos = null) {
        return this.currentAlgorithm.getBestActions(state, takeActionFunc, agentPos);
    }

    getActionProbabilities(state, takeActionFunc = null, agentPos = null) {
        return this.currentAlgorithm.getActionProbabilities(state, takeActionFunc, agentPos);
    }

    getValue(state) {
        return this.currentAlgorithm.getValue(state);
    }

    updateConfig(newConfig) {
        this.baseConfig = { ...this.baseConfig, ...newConfig };
        this.currentAlgorithm.updateConfig(newConfig);
    }

    reset() {
        this.currentAlgorithm.reset();
    }

    applyEpisodeUpdates() {
        if (this.currentAlgorithm instanceof MonteCarloAlgorithm) {
            this.currentAlgorithm.applyEpisodeUpdates();
        }
    }

    get qTable() { return this.currentAlgorithm.qTable || {}; }
    get vTable() { return this.currentAlgorithm.vTable || {}; }
    get hTable() { return this.currentAlgorithm.hTable || {}; }
    get mTable() { return this.currentAlgorithm.mTable || {}; }
    get wTable() { return this.currentAlgorithm.wTable || {}; }
}

export const actions = ['up', 'down', 'left', 'right'];

let algorithmManager = new AlgorithmManager('q-learning', 5, {
    learningRate: 0.1,
    discountFactor: 0.9,
    explorationRate: 0.2,
    explorationStrategy: 'epsilon-greedy'
});

export { algorithmManager };

function createTableProxy(tableGetter) {
    return new Proxy({}, {
        get: (target, prop) => {
            if (prop === Symbol.iterator || typeof prop === 'symbol') return undefined;
            return tableGetter()[prop];
        },
        has: (target, prop) => prop in tableGetter(),
        ownKeys: () => Object.keys(tableGetter()),
        getOwnPropertyDescriptor: (target, prop) => {
            if (prop in tableGetter()) {
                return { enumerable: true, configurable: true, value: tableGetter()[prop] };
            }
        }
    });
}

export const qTable = createTableProxy(() => algorithmManager.qTable);
export const vTable = createTableProxy(() => algorithmManager.vTable);
export const hTable = createTableProxy(() => algorithmManager.hTable);
export const mTable = createTableProxy(() => algorithmManager.mTable);
export const wTable = createTableProxy(() => algorithmManager.wTable);

export const getConfig = () => algorithmManager.currentAlgorithm.config;
export const getLearningRate = () => algorithmManager.currentAlgorithm.config.learningRate;
export const getDiscountFactor = () => algorithmManager.currentAlgorithm.config.discountFactor;
export const getExplorationRate = () => algorithmManager.currentAlgorithm.config.explorationRate;
export const getExplorationStrategy = () => algorithmManager.currentAlgorithm.config.explorationStrategy;
export const getSelectedAlgorithm = () => algorithmManager.algorithmType;

export let learningRate = 0.1;
export let discountFactor = 0.9;
export let explorationRate = 0.2;
export let explorationStrategy = 'epsilon-greedy';
export let selectedAlgorithm = 'q-learning';

export function initializeTables(gridSize) {
    algorithmManager.updateGridSize(gridSize);
}

export function learningStep(agentPos, gridSize, takeActionFunc, resetAgentFunc) {
    const currentState = `${agentPos.x},${agentPos.y}`;
    const action = algorithmManager.chooseAction(currentState, takeActionFunc, agentPos);
    const { nextState, reward, newAgentPos, done } = takeActionFunc(action, agentPos, gridSize);
    
    const result = algorithmManager.learningStep(currentState, action, reward, nextState, done, takeActionFunc, agentPos);
    
    return {
        ...result,
        newAgentPos: newAgentPos,
        reward: reward,
        done: done
    };
}

export function getBestActions(state, takeActionFunc = null, agentPos = null) {
    return algorithmManager.getBestActions(state, takeActionFunc, agentPos);
}

export function getActionProbabilities(state, takeActionFunc = null, agentPos = null) {
    return algorithmManager.getActionProbabilities(state, takeActionFunc, agentPos);
}

export function applyMonteCarloUpdates() {
    algorithmManager.applyEpisodeUpdates();
}

export function updateLearningRate(newLr) {
    learningRate = newLr;
    algorithmManager.updateConfig({ 
        learningRate: newLr,
    });
}

export function updateDiscountFactor(newDf) {
    discountFactor = newDf;
    algorithmManager.updateConfig({ discountFactor: newDf });
}

export function updateExplorationRate(newEr) {
    explorationRate = newEr;
    algorithmManager.updateConfig({ explorationRate: newEr });
}

export function updateExplorationStrategy(newStrategy) {
    explorationStrategy = newStrategy;
    algorithmManager.updateConfig({ explorationStrategy: newStrategy });
}

export function updateSelectedAlgorithm(newAlgo) {
    selectedAlgorithm = newAlgo;
    algorithmManager.switchAlgorithm(newAlgo);
    console.log("Selected algorithm updated to:", selectedAlgorithm);
}

export { Algorithm, AlgorithmFactory, AlgorithmManager };

export function getValueForState(state) {
    return algorithmManager.getValue(state);
} 