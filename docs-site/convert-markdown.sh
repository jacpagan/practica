#!/bin/bash

# Convert Markdown files to HTML for docs site
# This script converts your existing markdown documentation to HTML

set -e

echo "📝 Converting Markdown to HTML for docs site"
echo "============================================="

# Create directories if they don't exist
mkdir -p docs-site/architecture
mkdir -p docs-site/flows
mkdir -p docs-site/database
mkdir -p docs-site/api

# Function to convert markdown to HTML
convert_md_to_html() {
    local input_file=$1
    local output_file=$2
    local title=$3
    
    echo "Converting $input_file to $output_file"
    
    # Create the HTML file with template
    cat > "$output_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TITLE_PLACEHOLDER - Practika Docs</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .mermaid {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .content {
            max-width: 4xl;
            margin: 0 auto;
            padding: 2rem;
        }
        .back-link {
            display: inline-flex;
            align-items: center;
            color: #4299e1;
            text-decoration: none;
            margin-bottom: 2rem;
            font-weight: 600;
        }
        .back-link:hover {
            color: #3182ce;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Navigation -->
    <nav class="gradient-bg text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-6">
                <div class="flex items-center">
                    <i class="fas fa-dumbbell text-3xl mr-3"></i>
                    <div>
                        <h1 class="text-2xl font-bold">Practika</h1>
                        <p class="text-sm opacity-90">Documentation Hub</p>
                    </div>
                </div>
                <div class="hidden md:flex space-x-6">
                    <a href="../index.html" class="hover:text-blue-200">Home</a>
                    <a href="../interactive-diagrams.html" class="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-chart-network mr-2"></i>Interactive Diagrams
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="content">
        <a href="../index.html" class="back-link">
            <i class="fas fa-arrow-left mr-2"></i>
            Back to Documentation
        </a>
        
        <div class="bg-white rounded-lg shadow-md p-8">
            <h1 class="text-4xl font-bold mb-6">TITLE_PLACEHOLDER</h1>
            
            <div class="prose prose-lg max-w-none">
                <!-- Content will be inserted here -->
            </div>
        </div>
    </div>

    <script>
        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    </script>
</body>
</html>
EOF

    # Replace title placeholder
    sed -i '' "s/TITLE_PLACEHOLDER/$title/g" "$output_file"
    
    # Convert markdown content to HTML using pandoc
    if command -v pandoc &> /dev/null; then
        echo "Using pandoc for conversion..."
        # Create temporary HTML content
        pandoc "$input_file" -f markdown -t html --standalone | \
        sed -n '/<body>/,/<\/body>/p' | \
        sed '1d;$d' > /tmp/content.html
        
        # Fix Mermaid wrapper tags and HTML entities
        sed -i '' 's/<pre class="mermaid"><code>/<div class="mermaid">/g' /tmp/content.html
        sed -i '' 's/<\/code><\/pre>/<\/div>/g' /tmp/content.html
        sed -i '' 's/&quot;/"/g' /tmp/content.html
        sed -i '' 's/&lt;br\/&gt;/<br\/>/g' /tmp/content.html
        
        # Insert content into the template
        sed -i '' '/<!-- Content will be inserted here -->/r /tmp/content.html' "$output_file"
        sed -i '' '/<!-- Content will be inserted here -->/d' "$output_file"
        
        # Clean up
        rm /tmp/content.html
    else
        echo "⚠️  Pandoc not found. Using basic conversion..."
        # Basic markdown to HTML conversion
        cat "$input_file" | \
        sed 's/^# \(.*\)/<h1>\1<\/h1>/' | \
        sed 's/^## \(.*\)/<h2>\1<\/h2>/' | \
        sed 's/^### \(.*\)/<h3>\1<\/h3>/' | \
        sed 's/\*\*\(.*\)\*\*/<strong>\1<\/strong>/g' | \
        sed 's/\*\(.*\)\*/<em>\1<\/em>/g' | \
        sed 's/```mermaid/```mermaid\n<div class="mermaid">/' | \
        sed 's/```$/<\/div>\n```/' > /tmp/content.html
        
        sed -i '' '/<!-- Content will be inserted here -->/r /tmp/content.html' "$output_file"
        sed -i '' '/<!-- Content will be inserted here -->/d' "$output_file"
        
        rm /tmp/content.html
    fi
}

# Convert architecture files
if [ -f "docs/architecture/architecture-overview.md" ]; then
    convert_md_to_html "docs/architecture/architecture-overview.md" "docs-site/architecture/architecture-overview.html" "System Architecture Overview"
fi

if [ -f "docs/architecture/aws-infrastructure.md" ]; then
    convert_md_to_html "docs/architecture/aws-infrastructure.md" "docs-site/architecture/aws-infrastructure.html" "AWS Infrastructure"
fi

# Convert flow files
if [ -f "docs/flows/user-journey.md" ]; then
    convert_md_to_html "docs/flows/user-journey.md" "docs-site/flows/user-journey.html" "User Journey"
fi

if [ -f "docs/flows/video-annotation-flow.md" ]; then
    convert_md_to_html "docs/flows/video-annotation-flow.md" "docs-site/flows/video-annotation-flow.html" "Video Annotation Flow"
fi

if [ -f "docs/flows/playlist-creation-flow.md" ]; then
    convert_md_to_html "docs/flows/playlist-creation-flow.md" "docs-site/flows/playlist-creation-flow.html" "Playlist Creation Flow"
fi

# Convert database files
if [ -f "docs/database/database-erd.md" ]; then
    convert_md_to_html "docs/database/database-erd.md" "docs-site/database/database-erd.html" "Database ERD"
fi

if [ -f "docs/database/erd.sql" ]; then
    cp "docs/database/erd.sql" "docs-site/database/erd.sql"
fi

echo ""
echo "✅ Conversion complete!"
echo ""
echo "📁 Files created in docs-site/:"
find docs-site -name "*.html" -o -name "*.sql" | sort

echo ""
echo "🚀 Next steps:"
echo "1. Review the converted files"
echo "2. Run: cd docs-site && ./deploy.sh"
echo "3. Choose your deployment option"
echo "4. Set up your subdomain DNS"
