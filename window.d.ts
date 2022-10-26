export { }
declare global {
    type node_env_t = 'production' | 'development'
    interface MyDefinedCompileEnv {
        NODE_ENV: node_env_t,
    }
    interface Window {
        __COMPILE_ENV__: MyDefinedCompileEnv
    }
    /** Injected into JS/TS via webpack.DefinePlugin */
    const __COMPILE_ENV__: MyDefinedCompileEnv
}
