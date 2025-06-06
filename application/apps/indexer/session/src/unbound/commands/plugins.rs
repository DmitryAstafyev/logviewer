use std::path::PathBuf;

use crate::unbound::signal::Signal;
use plugins_host::plugins_manager::PluginsManager;
use stypes::{
    CommandOutcome, ComputationError, InvalidPluginEntity, InvalidPluginsList, PluginEntity,
    PluginRunData, PluginType, PluginsList, PluginsPathsList,
};
use tokio::sync::RwLock;

/// Initialize the plugin manager loading all the plugins from their directory.
pub async fn load_manager() -> Result<PluginsManager, ComputationError> {
    PluginsManager::load()
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))
}

/// Get all information of installed plugins .
pub async fn installed_plugins_list(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<PluginsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let installed_plugins = manager.installed_plugins().cloned().collect();

    let plugins = PluginsList(installed_plugins);

    Ok(CommandOutcome::Finished(plugins))
}

/// Get all information of invalid plugins .
pub async fn invalid_plugins_list(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<InvalidPluginsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let invalid_plugins = manager.invalid_plugins().cloned().collect();

    let plugins = InvalidPluginsList(invalid_plugins);

    Ok(CommandOutcome::Finished(plugins))
}

/// Get the directory paths (considered ID) of installed plugins .
pub async fn installed_plugins_paths(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<PluginsPathsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let installed_paths: Vec<_> = manager
        .installed_plugins_paths()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    let plugins = PluginsPathsList(installed_paths);

    Ok(CommandOutcome::Finished(plugins))
}

/// Get the directory paths (considered ID) of invalid plugins .
pub async fn invalid_plugins_paths(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<PluginsPathsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let invalid_paths: Vec<_> = manager
        .invalid_plugins_paths()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    let plugins = PluginsPathsList(invalid_paths);

    Ok(CommandOutcome::Finished(plugins))
}

/// Get all info for the installed plugin with provided directory path (considered ID)
pub async fn installed_plugins_info(
    plugin_path: String,
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<Option<PluginEntity>>, ComputationError> {
    let manager = plugins_manager.read().await;

    let plugin = manager
        .get_installed_plugin(&PathBuf::from(plugin_path))
        .cloned();

    Ok(CommandOutcome::Finished(plugin))
}

/// Get all info for the invalid plugin with provided directory path (considered ID)
pub async fn invalid_plugins_info(
    plugin_path: String,
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<Option<InvalidPluginEntity>>, ComputationError> {
    let manager = plugins_manager.read().await;

    let invalid_plug = manager
        .get_invalid_plugin(&PathBuf::from(plugin_path))
        .cloned();

    Ok(CommandOutcome::Finished(invalid_plug))
}

/// Retrieves runtime data for a plugin located at the specified path.
///
/// This method searches for the plugin's runtime data (`PluginRunData`) among both
/// successfully loaded plugins and failed ones.
///
/// # Parameters
/// - `plugin_path`: The directory path of the plugin.
///
/// # Returns
/// - `Some(&PluginRunData)`: If the plugin's runtime data is found.
/// - `None`: If no matching plugin is found.
pub async fn get_plugin_run_data(
    plugin_path: String,
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<Option<PluginRunData>>, ComputationError> {
    let manager = plugins_manager.read().await;

    let invalid_plug = manager
        .get_plugin_run_data(PathBuf::from(plugin_path))
        .cloned();

    Ok(CommandOutcome::Finished(invalid_plug))
}

/// Reload plugins from the plugins directory.
pub async fn reload_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<()>, ComputationError> {
    let mut manager = plugins_manager.write().await;

    manager
        .reload()
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))?;

    Ok(CommandOutcome::Finished(()))
}

/// Adds a plugin with the given directory path and the optional plugin type.
///
/// * `plugin_path`: Path of the plugin directory to be copied into chipmunk plugins directory.
/// * `plugin_type`: Type of the plugin, when not provided plugin type will be entered from plugin
///   `WIT` signature in its binary file.
pub async fn add_plugin(
    plugin_path: String,
    plugin_type: Option<PluginType>,
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<()>, ComputationError> {
    let mut manager = plugins_manager.write().await;

    manager
        .add_plugin(plugin_path.into(), plugin_type)
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))?;

    Ok(CommandOutcome::Finished(()))
}

/// Removes the plugin with the given directory path.
///
/// * `plugin_path`: Path of the plugin Chipmunk plugins directory.
pub async fn remove_plugin(
    plugin_path: String,
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<()>, ComputationError> {
    let mut manager = plugins_manager.write().await;

    manager
        .remove_plugin(PathBuf::from(plugin_path).as_path())
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))?;

    Ok(CommandOutcome::Finished(()))
}
