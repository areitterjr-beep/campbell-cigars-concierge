import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'src/data/cigars.json')

// Simple password check (in production, use proper authentication)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// GET - Fetch all inventory
export async function GET(request: NextRequest) {
  try {
    const password = request.headers.get('x-admin-password')
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const cigarsData = JSON.parse(data)
    
    return NextResponse.json(cigarsData)
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

// POST - Add new cigar
export async function POST(request: NextRequest) {
  try {
    const password = request.headers.get('x-admin-password')
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const newCigar = await request.json()
    
    // Validate required fields
    const requiredFields = ['name', 'brand', 'body', 'strength', 'description']
    for (const field of requiredFields) {
      if (!newCigar[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const cigarsData = JSON.parse(data)
    
    // Generate ID and barcode if not provided
    const maxId = Math.max(...cigarsData.cigars.map((c: any) => parseInt(c.id) || 0))
    newCigar.id = (maxId + 1).toString()
    
    if (!newCigar.barcode) {
      newCigar.barcode = `AUTO${Date.now()}`
    }
    
    // Set defaults for optional fields
    newCigar.inventory = newCigar.inventory || 0
    newCigar.tastingNotes = newCigar.tastingNotes || []
    newCigar.pairings = newCigar.pairings || { alcoholic: [], nonAlcoholic: [] }
    newCigar.bestFor = newCigar.bestFor || []
    
    cigarsData.cigars.push(newCigar)
    
    await fs.writeFile(DATA_FILE, JSON.stringify(cigarsData, null, 2))
    
    return NextResponse.json({ success: true, cigar: newCigar })
  } catch (error) {
    console.error('Inventory POST error:', error)
    return NextResponse.json(
      { error: 'Failed to add cigar' },
      { status: 500 }
    )
  }
}

// PUT - Update cigar (including inventory count)
export async function PUT(request: NextRequest) {
  try {
    const password = request.headers.get('x-admin-password')
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    const { id, ...updateData } = updates
    
    if (!id) {
      return NextResponse.json(
        { error: 'Cigar ID is required' },
        { status: 400 }
      )
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const cigarsData = JSON.parse(data)
    
    const cigarIndex = cigarsData.cigars.findIndex((c: any) => c.id === id)
    
    if (cigarIndex === -1) {
      return NextResponse.json(
        { error: 'Cigar not found' },
        { status: 404 }
      )
    }
    
    // Update the cigar
    cigarsData.cigars[cigarIndex] = {
      ...cigarsData.cigars[cigarIndex],
      ...updateData,
    }
    
    await fs.writeFile(DATA_FILE, JSON.stringify(cigarsData, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      cigar: cigarsData.cigars[cigarIndex] 
    })
  } catch (error) {
    console.error('Inventory PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update cigar' },
      { status: 500 }
    )
  }
}

// DELETE - Remove cigar
export async function DELETE(request: NextRequest) {
  try {
    const password = request.headers.get('x-admin-password')
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Cigar ID is required' },
        { status: 400 }
      )
    }

    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const cigarsData = JSON.parse(data)
    
    const cigarIndex = cigarsData.cigars.findIndex((c: any) => c.id === id)
    
    if (cigarIndex === -1) {
      return NextResponse.json(
        { error: 'Cigar not found' },
        { status: 404 }
      )
    }
    
    const deletedCigar = cigarsData.cigars.splice(cigarIndex, 1)[0]
    
    await fs.writeFile(DATA_FILE, JSON.stringify(cigarsData, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      deleted: deletedCigar 
    })
  } catch (error) {
    console.error('Inventory DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete cigar' },
      { status: 500 }
    )
  }
}
