# Apple App Store Submission Checklist for TLC PharmaSight

## Pre-Submission Requirements

### 1. Apple Developer Account
- [ ] Active Apple Developer Program membership ($99/year)
- [ ] Access to App Store Connect
- [ ] Valid payment method on file

### 2. App Store Connect Setup
- [ ] Create new app in App Store Connect
- [ ] Set bundle ID: `com.tlcpharmacy.pharmasight`
- - [ ] Ensure this matches your app.json exactly
- [ ] Set app name: "TLC PharmaSight"
- [ ] Set primary language: English
- [ ] Set primary category: Business
- [ ] Set secondary category: Medical

### 3. App Information
- [ ] App description (4000 characters max)
- [ ] Keywords (100 characters max)
- [ ] Support URL (your website)
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL (required)

### 4. App Store Screenshots
- [ ] iPhone 6.7" Display (1290 x 2796 px) - 3 required
- [ ] iPhone 6.5" Display (1242 x 2688 px) - 3 required  
- [ ] iPhone 5.5" Display (1242 x 2208 px) - 3 required
- [ ] iPad Pro 12.9" Display (2048 x 2732 px) - 3 required
- [ ] iPad Pro 12.9" Display 2nd gen (2048 x 2732 px) - 3 required

### 5. App Icon
- [ ] 1024 x 1024 px PNG format
- [ ] No transparency
- [ ] No rounded corners (Apple adds them automatically)
- [ ] Matches your app's visual identity

## Technical Requirements

### 6. Build Configuration
- [ ] Update app.json bundleIdentifier to `com.tlcpharmacy.pharmasight`
- [ ] Set buildNumber to "1" for first submission
- [ ] Ensure version is "1.0.0"
- [ ] Verify all required permissions have usage descriptions

### 7. Privacy & Security
- [ ] Privacy Policy document created and hosted
- [ ] App Privacy details completed in App Store Connect
- [ ] Data collection practices documented
- [ ] User consent mechanisms implemented
- [ ] GDPR compliance (if applicable)

### 8. App Store Guidelines Compliance
- [ ] No placeholder content
- [ ] All features functional
- [ ] No broken links
- [ ] Professional appearance
- [ ] Appropriate content for all ages
- [ ] No misleading information

## Build & Submission Process

### 9. EAS Build
```bash
# Install EAS CLI if not already installed
npm install -g @expo/eas-cli

# Login to your Expo account
eas login

# Configure build (if not already done)
eas build:configure

# Build for iOS App Store
eas build --platform ios --profile production
```

### 10. App Store Connect Submission
- [ ] Upload build to App Store Connect
- [ ] Complete app review information
- [ ] Answer all review questions
- [ ] Set app availability and pricing
- [ ] Submit for review

### 11. Review Process
- [ ] Typical review time: 24-48 hours
- [ ] Monitor review status in App Store Connect
- [ ] Respond to any review team questions promptly
- [ ] Be prepared for potential rejection and resubmission

## Post-Approval

### 12. App Store Release
- [ ] Set release type (automatic or manual)
- [ ] Monitor app performance
- [ ] Respond to user reviews
- [ ] Plan future updates

### 13. Marketing & Promotion
- [ ] App Store Optimization (ASO)
- [ ] Social media announcements
- [ ] Website updates
- [ ] User onboarding materials

## Common Rejection Reasons to Avoid

- [ ] Missing privacy policy
- [ ] Incomplete app information
- [ ] Broken functionality
- [ ] Inappropriate content
- [ ] Missing usage descriptions for permissions
- [ ] App crashes or freezes
- [ ] Poor user experience
- [ ] Missing required features

## Required URLs for App Store Connect

### Privacy Policy
- Must be accessible and comprehensive
- Should cover data collection, usage, and sharing
- Include contact information

### Support URL
- Working website or support page
- Contact information for users
- FAQ or help documentation

## Testing Before Submission

- [ ] Test on multiple iOS devices
- [ ] Test all app features thoroughly
- [ ] Verify push notifications work
- [ ] Test offline functionality
- [ ] Check for memory leaks
- [ ] Verify accessibility features
- [ ] Test on different iOS versions

## Final Checklist Before Submit

- [ ] All screenshots uploaded and approved
- [ ] App description and keywords finalized
- [ ] Privacy policy accessible
- [ ] Support information complete
- [ ] Build successfully uploaded
- [ ] All review questions answered
- [ ] App ready for public release
- [ ] Team notified of submission

## Important Notes

- **Bundle ID**: Must be unique and cannot be changed after first submission
- **Version**: Must increment for each update
- **Build Number**: Must increment for each build
- **Review Process**: Can take 1-3 days, plan accordingly
- **Rejection**: Common for first submissions, don't panic
- **Support**: Apple provides detailed feedback for rejections

## Resources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple Developer Documentation](https://developer.apple.com/documentation/) 