"""
Storage backend registry following Open/Closed principle
"""

from typing import Dict, Type
from core.interfaces.storage import StorageBackend


class StorageBackendRegistry:
    """Registry for storage backends - allows adding new backends without modifying existing code"""
    
    _backends: Dict[str, Type[StorageBackend]] = {}
    
    @classmethod
    def register(cls, name: str, backend_class: Type[StorageBackend]):
        """Register a new storage backend"""
        cls._backends[name] = backend_class
    
    @classmethod
    def get_backend_class(cls, name: str) -> Type[StorageBackend]:
        """Get backend class by name"""
        if name not in cls._backends:
            raise ValueError(f"Storage backend '{name}' not registered")
        return cls._backends[name]
    
    @classmethod
    def list_backends(cls) -> list[str]:
        """List all registered backend names"""
        return list(cls._backends.keys())
    
    @classmethod
    def create_backend(cls, name: str, **kwargs) -> StorageBackend:
        """Create an instance of the specified backend"""
        backend_class = cls.get_backend_class(name)
        return backend_class(**kwargs)


# Backend factory function
def create_storage_backend(backend_name: str, **kwargs) -> StorageBackend:
    """Factory function to create storage backends"""
    return StorageBackendRegistry.create_backend(backend_name, **kwargs)
