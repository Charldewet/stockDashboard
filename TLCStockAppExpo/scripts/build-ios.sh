#!/bin/bash

# TLC PharmaSight iOS App Store Build Script
# This script automates the iOS build process for App Store submission

set -e  # Exit on any error

echo "🚀 Starting TLC PharmaSight iOS Build Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if EAS CLI is installed
check_eas_cli() {
    print_status "Checking EAS CLI installation..."
    if ! command -v eas &> /dev/null; then
        print_error "EAS CLI is not installed. Installing now..."
        npm install -g @expo/eas-cli
    else
        print_success "EAS CLI is already installed"
    fi
}

# Check if logged into Expo
check_expo_login() {
    print_status "Checking Expo login status..."
    if ! eas whoami &> /dev/null; then
        print_warning "Not logged into Expo. Please login:"
        eas login
    else
        print_success "Already logged into Expo"
    fi
}

# Validate configuration files
validate_config() {
    print_status "Validating configuration files..."
    
    # Check app.json
    if [ ! -f "app.json" ]; then
        print_error "app.json not found!"
        exit 1
    fi
    
    # Check eas.json
    if [ ! -f "eas.json" ]; then
        print_error "eas.json not found!"
        exit 1
    fi
    
    # Check package.json
    if [ ! -f "package.json" ]; then
        print_error "package.json not found!"
        exit 1
    fi
    
    print_success "Configuration files validated"
}

# Check bundle identifier
check_bundle_id() {
    print_status "Checking bundle identifier..."
    
    # Extract bundle ID from app.json
    BUNDLE_ID=$(node -e "
        const config = require('./app.json');
        console.log(config.expo.ios.bundleIdentifier);
    ")
    
    if [ "$BUNDLE_ID" != "com.tlcpharmacy.pharmasight" ]; then
        print_error "Bundle ID mismatch! Expected: com.tlcpharmacy.pharmasight, Found: $BUNDLE_ID"
        print_warning "Please update app.json with correct bundle identifier"
        exit 1
    fi
    
    print_success "Bundle identifier is correct: $BUNDLE_ID"
}

# Check version and build number
check_version() {
    print_status "Checking app version and build number..."
    
    # Extract version from app.json
    VERSION=$(node -e "
        const config = require('./app.json');
        console.log(config.expo.version);
    ")
    
    # Extract build number from app.json
    BUILD_NUMBER=$(node -e "
        const config = require('./app.json');
        console.log(config.expo.ios.buildNumber || 'not set');
    ")
    
    print_status "App Version: $VERSION"
    print_status "Build Number: $BUILD_NUMBER"
    
    if [ "$BUILD_NUMBER" = "not set" ]; then
        print_warning "Build number not set in app.json"
    fi
}

# Run pre-build checks
pre_build_checks() {
    print_status "Running pre-build checks..."
    
    # Check for any TypeScript errors
    if [ -f "tsconfig.json" ]; then
        print_status "Checking TypeScript compilation..."
        if npx tsc --noEmit; then
            print_success "TypeScript compilation passed"
        else
            print_error "TypeScript compilation failed!"
            exit 1
        fi
    fi
    
    # Check for any linting errors
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
        print_status "Running ESLint..."
        if npx eslint src/ --ext .ts,.tsx; then
            print_success "ESLint passed"
        else
            print_warning "ESLint found issues, but continuing with build..."
        fi
    fi
    
    print_success "Pre-build checks completed"
}

# Build the app
build_app() {
    print_status "Starting iOS build process..."
    
    # Check if we should use a specific profile
    BUILD_PROFILE=${1:-production}
    
    print_status "Using build profile: $BUILD_PROFILE"
    
    # Start the build
    print_status "Initiating EAS build..."
    eas build --platform ios --profile $BUILD_PROFILE --non-interactive
    
    print_success "Build process initiated successfully!"
    print_status "Monitor build progress at: https://expo.dev/accounts/cdewet05/projects/TLCStockAppExpo/builds"
}

# Main execution
main() {
    echo "📱 TLC PharmaSight iOS Build Script"
    echo "====================================="
    echo ""
    
    # Parse command line arguments
    BUILD_PROFILE=${1:-production}
    
    print_status "Build profile: $BUILD_PROFILE"
    print_status "Target platform: iOS"
    print_status "Distribution: App Store"
    echo ""
    
    # Run all checks
    check_eas_cli
    check_expo_login
    validate_config
    check_bundle_id
    check_version
    pre_build_checks
    
    echo ""
    print_status "All pre-build checks passed! Starting build process..."
    echo ""
    
    # Start the build
    build_app $BUILD_PROFILE
    
    echo ""
    print_success "Build process completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Monitor build progress at Expo dashboard"
    echo "2. Download the .ipa file when build completes"
    echo "3. Upload to App Store Connect"
    echo "4. Complete app review information"
    echo "5. Submit for App Store review"
    echo ""
    echo "📚 For detailed submission steps, see: APP_STORE_SUBMISSION_GUIDE.md"
}

# Run main function with all arguments
main "$@" 