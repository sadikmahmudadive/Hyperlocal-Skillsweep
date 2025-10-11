import os
import sys
from pathlib import Path

class ProjectScanner:
    def __init__(self, project_root=None):
        self.project_root = project_root or os.getcwd()
        self.critical_files = [
            'lib/dbConnect.js',
            'models/User.js', 
            'pages/api/users/[id].js',
            'pages/api/auth/register.js',
            'pages/api/auth/login.js',
            'pages/api/auth/me.js',
            'components/search/SearchResults.js'
        ]
        
    def scan_project(self):
        print("=" * 60)
        print("HYPERLOCAL SKILLSWAP PROJECT SCANNER")
        print("=" * 60)
        print(f"Project Root: {self.project_root}")
        print()
        
        self.check_critical_files()
        print()
        self.show_directory_tree()
        print()
        self.analyze_file_types()
        print()
        self.check_file_contents()
        
    def check_critical_files(self):
        print("🔍 CRITICAL FILES CHECK:")
        print("-" * 40)
        
        found_count = 0
        missing_files = []
        
        for file_path in self.critical_files:
            full_path = os.path.join(self.project_root, file_path)
            if os.path.exists(full_path):
                print(f"✅ {file_path}")
                found_count += 1
            else:
                print(f"❌ {file_path}")
                missing_files.append(file_path)
        
        print(f"\n📊 Summary: {found_count}/{len(self.critical_files)} critical files found")
        
        if missing_files:
            print("\n🚨 MISSING FILES:")
            for missing in missing_files:
                print(f"   - {missing}")
    
    def show_directory_tree(self, max_depth=4):
        print("📁 DIRECTORY TREE:")
        print("-" * 40)
        
        def print_tree(dir_path, prefix="", depth=0):
            if depth > max_depth:
                return
                
            try:
                entries = sorted(os.listdir(dir_path))
                for i, entry in enumerate(entries):
                    full_path = os.path.join(dir_path, entry)
                    is_last = i == len(entries) - 1
                    
                    if os.path.isdir(full_path):
                        print(f"{prefix}{'└── ' if is_last else '├── '}📁 {entry}/")
                        new_prefix = prefix + ("    " if is_last else "│   ")
                        print_tree(full_path, new_prefix, depth + 1)
                    else:
                        extension = Path(entry).suffix
                        icon = "📄" if extension in ['.js', '.jsx', '.ts', '.tsx'] else "📝"
                        print(f"{prefix}{'└── ' if is_last else '├── '}{icon} {entry}")
            except PermissionError:
                print(f"{prefix}└── 🔒 Permission denied")
        
        print_tree(self.project_root)
    
    def analyze_file_types(self):
        print("📊 FILE TYPE ANALYSIS:")
        print("-" * 40)
        
        file_types = {}
        total_files = 0
        
        for root, dirs, files in os.walk(self.project_root):
            for file in files:
                total_files += 1
                ext = Path(file).suffix.lower()
                file_types[ext] = file_types.get(ext, 0) + 1
        
        # Sort by count descending
        sorted_types = sorted(file_types.items(), key=lambda x: x[1], reverse=True)
        
        for ext, count in sorted_types:
            percentage = (count / total_files) * 100
            print(f"{ext or 'no extension':<8} {count:>4} files ({percentage:.1f}%)")
        
        print(f"\nTotal files: {total_files}")
    
    def check_file_contents(self):
        print("🔎 FILE CONTENT CHECK:")
        print("-" * 40)
        
        files_to_check = [
            'lib/dbConnect.js',
            'pages/api/users/[id].js',
            'package.json'
        ]
        
        for file_path in files_to_check:
            full_path = os.path.join(self.project_root, file_path)
            if os.path.exists(full_path):
                print(f"\n📖 {file_path}:")
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = content.split('\n')
                        print(f"   Size: {len(content)} characters, {len(lines)} lines")
                        
                        # Check for specific content patterns
                        if file_path == 'lib/dbConnect.js':
                            if 'mongoose' in content and 'MONGODB_URI' in content:
                                print("   ✅ Contains mongoose and MONGODB_URI")
                            else:
                                print("   ⚠️  Missing expected content")
                                
                        elif file_path == 'pages/api/users/[id].js':
                            if 'dbConnect' in content and 'User.findById' in content:
                                print("   ✅ Contains dbConnect and User.findById")
                            else:
                                print("   ⚠️  Missing expected content")
                                
                        elif file_path == 'package.json':
                            if '"dependencies"' in content:
                                print("   ✅ Contains dependencies")
                            else:
                                print("   ⚠️  Missing dependencies section")
                        
                        # Show first 3 lines
                        print("   First 3 lines:")
                        for i, line in enumerate(lines[:3]):
                            print(f"      {i+1}: {line[:80]}{'...' if len(line) > 80 else ''}")
                            
                except Exception as e:
                    print(f"   ❌ Error reading file: {e}")
            else:
                print(f"\n❌ {file_path} - FILE NOT FOUND")
    
    def find_file(self, filename):
        """Search for a specific file in the project"""
        print(f"\n🔍 SEARCHING FOR: {filename}")
        print("-" * 40)
        
        matches = []
        for root, dirs, files in os.walk(self.project_root):
            for file in files:
                if filename.lower() in file.lower():
                    full_path = os.path.join(root, file)
                    relative_path = os.path.relpath(full_path, self.project_root)
                    matches.append(relative_path)
        
        if matches:
            for match in matches:
                print(f"✅ {match}")
        else:
            print("❌ File not found")
        
        return matches

def main():
    scanner = ProjectScanner()
    
    while True:
        print("\n" + "=" * 60)
        print("HYPERLOCAL SKILLSWAP SCANNER MENU")
        print("=" * 60)
        print("1. Full Project Scan")
        print("2. Check Critical Files Only")
        print("3. Show Directory Tree")
        print("4. Search for Specific File")
        print("5. Check File Contents")
        print("6. Exit")
        print("-" * 40)
        
        choice = input("Choose an option (1-6): ").strip()
        
        if choice == '1':
            scanner.scan_project()
        elif choice == '2':
            scanner.check_critical_files()
        elif choice == '3':
            scanner.show_directory_tree()
        elif choice == '4':
            filename = input("Enter filename to search for: ").strip()
            scanner.find_file(filename)
        elif choice == '5':
            scanner.check_file_contents()
        elif choice == '6':
            print("Goodbye! 👋")
            break
        else:
            print("Invalid choice. Please try again.")
        
        input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()