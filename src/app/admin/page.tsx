'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Lock, 
  LogOut, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Package,
  AlertTriangle,
  Search,
  RefreshCw,
  Upload,
  Image as ImageIcon
} from 'lucide-react'
import Link from 'next/link'

interface Cigar {
  id: string
  barcode: string
  name: string
  brand: string
  origin: string
  wrapper: string
  binder: string
  filler: string
  body: string
  strength: string
  length: string
  ringGauge: number
  description: string
  tastingNotes: string[]
  pairings: {
    alcoholic: string[]
    nonAlcoholic: string[]
  }
  priceRange: string
  smokingTime: string
  bestFor: string[]
  inventory: number
  imageUrl?: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [cigars, setCigars] = useState<Cigar[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCigar, setEditingCigar] = useState<Cigar | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCigar, setNewCigar] = useState<Partial<Cigar>>({
    name: '',
    brand: '',
    origin: '',
    wrapper: '',
    body: 'Medium',
    strength: 'Medium',
    description: '',
    tastingNotes: [],
    pairings: { alcoholic: [], nonAlcoholic: [] },
    bestFor: [],
    priceRange: '',
    smokingTime: '',
    inventory: 0,
    imageUrl: '',
  })

  const storedPassword = typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : null

  useEffect(() => {
    if (storedPassword) {
      setPassword(storedPassword)
      setIsAuthenticated(true)
      fetchInventory(storedPassword)
    }
  }, [])

  const handleLogin = async () => {
    setAuthError('')
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/inventory', {
        headers: { 'x-admin-password': password },
      })
      
      if (response.ok) {
        const data = await response.json()
        setCigars(data.cigars)
        setIsAuthenticated(true)
        sessionStorage.setItem('adminPassword', password)
      } else {
        setAuthError('Invalid password')
      }
    } catch (error) {
      setAuthError('Failed to authenticate')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPassword('')
    setCigars([])
    sessionStorage.removeItem('adminPassword')
  }

  const fetchInventory = async (pwd?: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory', {
        headers: { 'x-admin-password': pwd || password },
      })
      
      if (response.ok) {
        const data = await response.json()
        setCigars(data.cigars)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateInventory = async (id: string, inventory: number) => {
    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ id, inventory }),
      })
      
      if (response.ok) {
        setCigars((prev) =>
          prev.map((c) => (c.id === id ? { ...c, inventory } : c))
        )
      }
    } catch (error) {
      console.error('Failed to update inventory:', error)
    }
  }

  const saveCigarEdit = async () => {
    if (!editingCigar) return
    
    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(editingCigar),
      })
      
      if (response.ok) {
        setCigars((prev) =>
          prev.map((c) => (c.id === editingCigar.id ? editingCigar : c))
        )
        setEditingCigar(null)
      }
    } catch (error) {
      console.error('Failed to save cigar:', error)
    }
  }

  const addNewCigar = async () => {
    if (!newCigar.name || !newCigar.brand) return
    
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(newCigar),
      })
      
      if (response.ok) {
        const data = await response.json()
        setCigars((prev) => [...prev, data.cigar])
        setShowAddForm(false)
        setNewCigar({
          name: '',
          brand: '',
          origin: '',
          wrapper: '',
          body: 'Medium',
          strength: 'Medium',
          description: '',
          tastingNotes: [],
          pairings: { alcoholic: [], nonAlcoholic: [] },
          bestFor: [],
          priceRange: '',
          smokingTime: '',
          inventory: 0,
        })
      }
    } catch (error) {
      console.error('Failed to add cigar:', error)
    }
  }

  const deleteCigar = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cigar?')) return
    
    try {
      const response = await fetch(`/api/inventory?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password },
      })
      
      if (response.ok) {
        setCigars((prev) => prev.filter((c) => c.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete cigar:', error)
    }
  }

  const filteredCigars = cigars.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.brand.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const lowStockCigars = cigars.filter((c) => c.inventory <= 10)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cigar-cream to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-cigar-dark rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-cigar-gold" />
            </div>
            <h1 className="text-2xl font-bold text-cigar-dark">Admin Login</h1>
            <p className="text-gray-600 mt-2">Enter password to manage inventory</p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter admin password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 
                       focus:outline-none focus:ring-2 focus:ring-cigar-gold"
            />
            
            {authError && (
              <p className="text-red-500 text-sm">{authError}</p>
            )}
            
            <button
              onClick={handleLogin}
              disabled={isLoading || !password}
              className="w-full bg-cigar-gold hover:bg-cigar-amber disabled:bg-gray-300 
                       text-cigar-dark font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </button>

            <Link
              href="/"
              className="block text-center text-cigar-gold hover:text-cigar-amber transition-colors"
            >
              Back to Store
            </Link>
          </div>
          
          <p className="text-xs text-gray-400 text-center mt-6">
            Default password: admin123 (change in .env)
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cigar-cream to-white">
      {/* Header */}
      <header className="bg-cigar-dark text-cigar-cream py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-cigar-gold">Inventory</span> Management
            </h1>
            <p className="text-sm text-cigar-cream/70">Campbell Cigars Concierge Admin</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-cigar-cream/70 hover:text-cigar-gold transition-colors"
            >
              View Store
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-cigar-cream/70 hover:text-cigar-gold transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cigar-gold/20 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-cigar-gold" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Products</p>
                <p className="text-2xl font-bold text-cigar-dark">{cigars.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Units</p>
                <p className="text-2xl font-bold text-cigar-dark">
                  {cigars.reduce((sum, c) => sum + c.inventory, 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold text-amber-600">{lowStockCigars.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {cigars.filter((c) => c.inventory === 0).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockCigars.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Low Stock Alert</span>
            </div>
            <p className="text-amber-600 text-sm">
              {lowStockCigars.map((c) => c.name).join(', ')} - Consider restocking soon!
            </p>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or brand..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl 
                       focus:outline-none focus:ring-2 focus:ring-cigar-gold"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => fetchInventory()}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 
                       rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-cigar-gold hover:bg-cigar-amber 
                       text-cigar-dark font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Cigar
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cigar-dark text-cigar-cream">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Cigar</th>
                  <th className="px-6 py-4 text-left font-semibold">Brand</th>
                  <th className="px-6 py-4 text-center font-semibold">Image</th>
                  <th className="px-6 py-4 text-left font-semibold">Body</th>
                  <th className="px-6 py-4 text-left font-semibold">Price</th>
                  <th className="px-6 py-4 text-center font-semibold">Stock</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCigars.map((cigar) => (
                  <tr key={cigar.id} className="hover:bg-cigar-cream/30">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-cigar-dark">{cigar.name}</p>
                        <p className="text-sm text-gray-500">{cigar.barcode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{cigar.brand}</td>
                    <td className="px-6 py-4 text-center">
                      {(cigar as any).imageUrl ? (
                        <img 
                          src={(cigar as any).imageUrl} 
                          alt={cigar.name}
                          className="h-10 w-10 object-contain mx-auto rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <span className="text-gray-300">
                          <ImageIcon className="w-5 h-5 mx-auto" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        cigar.body.toLowerCase().includes('light') ? 'bg-amber-100 text-amber-800' :
                        cigar.body.toLowerCase().includes('medium') ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {cigar.body}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{cigar.priceRange}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateInventory(cigar.id, Math.max(0, cigar.inventory - 1))}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 
                                   flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                        <span className={`w-12 text-center font-semibold ${
                          cigar.inventory === 0 ? 'text-red-600' :
                          cigar.inventory <= 10 ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {cigar.inventory}
                        </span>
                        <button
                          onClick={() => updateInventory(cigar.id, cigar.inventory + 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 
                                   flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingCigar(cigar)}
                          className="p-2 text-cigar-gold hover:bg-cigar-cream rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteCigar(cigar.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editingCigar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-cigar-dark">Edit Cigar</h2>
              <button
                onClick={() => setEditingCigar(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingCigar.name}
                    onChange={(e) => setEditingCigar({ ...editingCigar, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingCigar.brand}
                    onChange={(e) => setEditingCigar({ ...editingCigar, brand: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                  <select
                    value={editingCigar.body}
                    onChange={(e) => setEditingCigar({ ...editingCigar, body: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Light">Light</option>
                    <option value="Light-Medium">Light-Medium</option>
                    <option value="Medium">Medium</option>
                    <option value="Medium-Full">Medium-Full</option>
                    <option value="Full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                  <select
                    value={editingCigar.strength}
                    onChange={(e) => setEditingCigar({ ...editingCigar, strength: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Mild">Mild</option>
                    <option value="Mild-Medium">Mild-Medium</option>
                    <option value="Medium">Medium</option>
                    <option value="Medium-Full">Medium-Full</option>
                    <option value="Full">Full</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                  <input
                    type="text"
                    value={editingCigar.priceRange}
                    onChange={(e) => setEditingCigar({ ...editingCigar, priceRange: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="$10-15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inventory</label>
                  <input
                    type="number"
                    value={editingCigar.inventory}
                    onChange={(e) => setEditingCigar({ ...editingCigar, inventory: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingCigar.description}
                  onChange={(e) => setEditingCigar({ ...editingCigar, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasting Notes (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingCigar.tastingNotes.join(', ')}
                  onChange={(e) => setEditingCigar({ 
                    ...editingCigar, 
                    tastingNotes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Cedar, Cream, Pepper"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCigar.imageUrl || ''}
                    onChange={(e) => setEditingCigar({ ...editingCigar, imageUrl: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://example.com/cigar-image.png"
                  />
                </div>
                {editingCigar.imageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={editingCigar.imageUrl} 
                      alt="Preview" 
                      className="h-16 object-contain rounded border"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingCigar({ ...editingCigar, imageUrl: '' })}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingCigar(null)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveCigarEdit}
                className="flex items-center gap-2 bg-cigar-gold hover:bg-cigar-amber 
                         text-cigar-dark font-semibold px-6 py-2 rounded-lg"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-cigar-dark">Add New Cigar</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newCigar.name}
                    onChange={(e) => setNewCigar({ ...newCigar, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Cigar name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    value={newCigar.brand}
                    onChange={(e) => setNewCigar({ ...newCigar, brand: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Brand name"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                  <input
                    type="text"
                    value={newCigar.origin}
                    onChange={(e) => setNewCigar({ ...newCigar, origin: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Nicaragua, Dominican Republic, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wrapper</label>
                  <input
                    type="text"
                    value={newCigar.wrapper}
                    onChange={(e) => setNewCigar({ ...newCigar, wrapper: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Connecticut, Maduro, etc."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                  <select
                    value={newCigar.body}
                    onChange={(e) => setNewCigar({ ...newCigar, body: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Light">Light</option>
                    <option value="Light-Medium">Light-Medium</option>
                    <option value="Medium">Medium</option>
                    <option value="Medium-Full">Medium-Full</option>
                    <option value="Full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Strength *</label>
                  <select
                    value={newCigar.strength}
                    onChange={(e) => setNewCigar({ ...newCigar, strength: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Mild">Mild</option>
                    <option value="Mild-Medium">Mild-Medium</option>
                    <option value="Medium">Medium</option>
                    <option value="Medium-Full">Medium-Full</option>
                    <option value="Full">Full</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                  <input
                    type="text"
                    value={newCigar.priceRange}
                    onChange={(e) => setNewCigar({ ...newCigar, priceRange: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="$10-15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Inventory</label>
                  <input
                    type="number"
                    value={newCigar.inventory}
                    onChange={(e) => setNewCigar({ ...newCigar, inventory: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={newCigar.description}
                  onChange={(e) => setNewCigar({ ...newCigar, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Describe the cigar..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Smoking Time</label>
                <input
                  type="text"
                  value={newCigar.smokingTime}
                  onChange={(e) => setNewCigar({ ...newCigar, smokingTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="45-60 minutes"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={newCigar.imageUrl || ''}
                  onChange={(e) => setNewCigar({ ...newCigar, imageUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="https://example.com/cigar-image.png"
                />
                {newCigar.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={newCigar.imageUrl} 
                      alt="Preview" 
                      className="h-16 object-contain rounded border"
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addNewCigar}
                disabled={!newCigar.name || !newCigar.brand || !newCigar.description}
                className="flex items-center gap-2 bg-cigar-gold hover:bg-cigar-amber disabled:bg-gray-300
                         text-cigar-dark font-semibold px-6 py-2 rounded-lg"
              >
                <Plus className="w-5 h-5" />
                Add Cigar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
