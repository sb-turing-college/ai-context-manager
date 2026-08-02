/**
 * Status topics + user facts load/CRUD extracted from App.tsx (SoC Phase 1).
 */

import { useState, useEffect, useCallback } from 'react'
import type { StatusTopicItem, UserFactItem, UserFactCategory } from '../types'
import * as statusService from '../services/statusService'
import * as userFactService from '../services/userFactService'

export function useStatusAndUserFacts(currentProject: string | null) {
  const [allStatusTopics, setAllStatusTopics] = useState<StatusTopicItem[]>([])
  const [userFacts, setUserFacts] = useState<UserFactItem[]>([])
  const [statusLoading, setStatusLoading] = useState(false)

  useEffect(() => {
    if (!currentProject) {
      setAllStatusTopics([])
      return
    }

    setStatusLoading(true)

    statusService.getStatusTopics(currentProject)
      .then(setAllStatusTopics)
      .catch((error) => {
        console.error('Failed to load status topics:', error)
      })
      .finally(() => {
        setStatusLoading(false)
      })
  }, [currentProject])

  useEffect(() => {
    userFactService.getUserFacts()
      .then(setUserFacts)
      .catch((error) => console.error('Failed to load user facts:', error))
  }, [])

  const statusTopics = allStatusTopics
    .filter((topic) => topic.projectId === currentProject)
    .sort((a, b) => a.order - b.order)

  const refreshStatus = useCallback(() => {
    if (!currentProject) return
    statusService.getStatusTopics(currentProject)
      .then(setAllStatusTopics)
      .catch((error) => console.error('Failed to refresh status:', error))
  }, [currentProject])

  const refreshUserFacts = useCallback(() => {
    userFactService.getUserFacts()
      .then(setUserFacts)
      .catch((error) => console.error('Failed to refresh user facts:', error))
  }, [])

  const handleCreateStatusTopic = async (title: string, content: string) => {
    if (!currentProject) return

    try {
      const newTopic = await statusService.createStatusTopic(currentProject, title, content)
      setAllStatusTopics((prev) => [...prev, newTopic])
    } catch (error) {
      console.error('Failed to create status topic:', error)
    }
  }

  const handleUpdateStatusTopic = async (topicId: string, title: string, content: string) => {
    try {
      const updatedTopic = await statusService.updateStatusTopic(topicId, { title, content })
      setAllStatusTopics((prev) =>
        prev.map((topic) => (topic.id === topicId ? updatedTopic : topic)),
      )
    } catch (error) {
      console.error('Failed to update status topic:', error)
    }
  }

  const handleDeleteStatusTopic = async (topicId: string) => {
    try {
      await statusService.deleteStatusTopic(topicId)
      setAllStatusTopics((prev) => prev.filter((topic) => topic.id !== topicId))
    } catch (error) {
      console.error('Failed to delete status topic:', topicId, error)
      if (currentProject) {
        statusService.getStatusTopics(currentProject)
          .then(setAllStatusTopics)
          .catch((e) => console.error('Failed to refresh:', e))
      }
    }
  }

  const handleCreateUserFact = async (
    title: string,
    content: string,
    category: UserFactCategory,
  ) => {
    try {
      const newFact = await userFactService.createUserFact(title, content, category)
      setUserFacts((prev) => [...prev, newFact])
    } catch (error) {
      console.error('Failed to create user fact:', error)
    }
  }

  const handleUpdateUserFact = async (
    factId: string,
    title: string,
    content: string,
    category: UserFactCategory,
  ) => {
    try {
      const updated = await userFactService.updateUserFact(factId, { title, content, category })
      setUserFacts((prev) => prev.map((f) => (f.id === factId ? updated : f)))
    } catch (error) {
      console.error('Failed to update user fact:', error)
    }
  }

  const handleDeleteUserFact = async (factId: string) => {
    try {
      await userFactService.deleteUserFact(factId)
      setUserFacts((prev) => prev.filter((f) => f.id !== factId))
    } catch (error) {
      console.error('Failed to delete user fact:', error)
      userFactService.getUserFacts()
        .then(setUserFacts)
        .catch((e) => console.error('Failed to refresh user facts:', e))
    }
  }

  return {
    allStatusTopics,
    setAllStatusTopics,
    userFacts,
    setUserFacts,
    statusLoading,
    statusTopics,
    refreshStatus,
    refreshUserFacts,
    handleCreateStatusTopic,
    handleUpdateStatusTopic,
    handleDeleteStatusTopic,
    handleCreateUserFact,
    handleUpdateUserFact,
    handleDeleteUserFact,
  }
}
