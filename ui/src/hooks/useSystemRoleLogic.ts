import { useState } from 'react'
import type { SystemRole, SystemRoleCategory } from '../types'

export function useSystemRoleLogic(
  allSystemRoles: SystemRole[],
  setAllSystemRoles: React.Dispatch<React.SetStateAction<SystemRole[]>>
) {
  const [systemRoleModalOpen, setSystemRoleModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<SystemRoleCategory>('chat')
  const [editingRole, setEditingRole] = useState<SystemRole | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [deleteConfirmRoleId, setDeleteConfirmRoleId] = useState<string | null>(null)

  // Open modal
  const handleOpenSystemRoleManager = () => {
    setSystemRoleModalOpen(true)
  }

  // Close modal
  const handleCloseSystemRoleManager = () => {
    setSystemRoleModalOpen(false)
    setEditingRole(null)
    setEditingTitle('')
    setEditingContent('')
    setDeleteConfirmRoleId(null)
  }

  // Get roles by category
  const getRolesByCategory = (category: SystemRoleCategory) => {
    return allSystemRoles.filter(role => role.category === category)
  }

  // Get default role for category
  const getDefaultRole = (category: SystemRoleCategory): SystemRole | undefined => {
    return allSystemRoles.find(role => role.category === category && role.isDefault)
  }

  // Create new role
  const handleCreateRole = (title: string, content: string, category: SystemRoleCategory) => {
    const newRole: SystemRole = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      title,
      content,
      category,
      isDefault: false,
      lastModified: new Date().toISOString()
    }
    setAllSystemRoles(roles => [...roles, newRole])
  }

  // Update role
  const handleUpdateRole = (roleId: string, title: string, content: string) => {
    setAllSystemRoles(roles => 
      roles.map(role => 
        role.id === roleId 
          ? { ...role, title, content, lastModified: new Date().toISOString() }
          : role
      )
    )
    setEditingRole(null)
    setEditingTitle('')
    setEditingContent('')
  }

  // Delete role
  const handleDeleteRole = (roleId: string) => {
    setAllSystemRoles(roles => roles.filter(role => role.id !== roleId))
    setDeleteConfirmRoleId(null)
  }

  // Set as default
  const handleSetDefault = (roleId: string, category: SystemRoleCategory) => {
    setAllSystemRoles(roles => 
      roles.map(role => ({
        ...role,
        isDefault: role.category === category ? role.id === roleId : role.isDefault
      }))
    )
  }

  // Start editing
  const handleStartEdit = (role: SystemRole) => {
    setEditingRole(role)
    setEditingTitle(role.title)
    setEditingContent(role.content)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingRole(null)
    setEditingTitle('')
    setEditingContent('')
  }

  return {
    // State
    systemRoleModalOpen,
    selectedCategory,
    editingRole,
    editingTitle,
    editingContent,
    deleteConfirmRoleId,
    
    // Setters
    setSelectedCategory,
    setEditingTitle,
    setEditingContent,
    setDeleteConfirmRoleId,
    
    // Handlers
    handleOpenSystemRoleManager,
    handleCloseSystemRoleManager,
    getRolesByCategory,
    getDefaultRole,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    handleSetDefault,
    handleStartEdit,
    handleCancelEdit
  }
}
