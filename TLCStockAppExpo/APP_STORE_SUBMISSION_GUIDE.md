# Step-by-Step App Store Submission Guide for TLC PharmaSight

## Phase 1: Preparation (Week 1)

### Step 1: Apple Developer Account
1. **Verify Membership**: Ensure your Apple Developer Program membership is active
2. **Access App Store Connect**: Login to [App Store Connect](https://appstoreconnect.apple.com)
3. **Payment Method**: Confirm payment method is current

### Step 2: App Store Connect Setup
1. **Create New App**:
   - Click "My Apps" → "+" → "New App"
   - Platform: iOS
   - Name: TLC PharmaSight
   - Bundle ID: `com.tlcpharmacy.pharmasight`
   - SKU: `TLCPharmaSight2025` (unique identifier)
   - User Access: Full Access

2. **Basic App Information**:
   - Primary Language: English
   - Bundle ID: `com.tlcpharmacy.pharmasight`
   - SKU: `TLCPharmaSight2025`

### Step 3: App Information
1. **App Name**: TLC PharmaSight
2. **Subtitle**: Pharmacy Analytics Dashboard
3. **Description** (4000 characters max):
   ```
   TLC PharmaSight is a comprehensive pharmacy analytics dashboard designed specifically for TLC pharmacies. 
   
   Key Features:
   • Real-time performance metrics and KPIs
   • Daily, monthly, and yearly analytics
   • Stock management insights and low GP alerts
   • Multi-pharmacy support and management
   • Professional charts and data visualization
   • Secure authentication and data protection
   
   Perfect for pharmacy owners, managers, and healthcare business professionals who need actionable insights to optimize their pharmacy operations.
   ```

4. **Keywords**: pharmacy,analytics,dashboard,healthcare,business,metrics,TLC,pharmacy management
5. **Support URL**: [Your website URL]
6. **Marketing URL**: [Optional marketing page]
7. **Privacy Policy URL**: [Your privacy policy URL]

## Phase 2: Visual Assets (Week 1-2)

### Step 4: App Icon
1. **Create 1024x1024 PNG**:
   - No transparency
   - No rounded corners
   - High quality, professional appearance
   - Matches your brand identity

2. **Upload to App Store Connect**:
   - App Store Connect → Your App → App Information
   - Upload icon in the App Icon section

### Step 5: Screenshots
1. **Required Screenshots**:
   - iPhone 6.7" Display (1290 x 2796 px) - 3 screenshots
   - iPhone 6.5" Display (1242 x 2688 px) - 3 screenshots
   - iPhone 5.5" Display (1242 x 2208 px) - 3 screenshots
   - iPad Pro 12.9" Display (2048 x 2732 px) - 3 screenshots

2. **Screenshot Content**:
   - **Screenshot 1**: Login/Authentication screen
   - **Screenshot 2**: Main dashboard with charts
   - **Screenshot 3**: Stock management or analytics view

3. **Screenshot Guidelines**:
   - High quality, clear images
   - No placeholder text
   - Professional appearance
   - Show key app features

## Phase 3: Build & Upload (Week 2)

### Step 6: EAS Build
1. **Install EAS CLI**:
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Build for Production**:
   ```bash
   eas build --platform ios --profile production
   ```

4. **Monitor Build Progress**:
   - Build will take 15-30 minutes
   - Monitor progress in terminal or Expo dashboard
   - Download build when complete

### Step 7: Upload to App Store Connect
1. **Upload Build**:
   - App Store Connect → Your App → TestFlight
   - Click "Upload Build"
   - Select your .ipa file
   - Wait for processing (5-15 minutes)

2. **Build Processing**:
   - Apple will process your build
   - Check for any warnings or errors
   - Resolve any issues before proceeding

## Phase 4: App Review Information (Week 2)

### Step 8: App Review Details
1. **Demo Account**:
   - Create test account for Apple reviewers
   - Provide clear login credentials
   - Ensure account has access to all features

2. **Review Notes**:
   ```
   TLC PharmaSight is a pharmacy analytics dashboard for TLC pharmacies.
   
   Demo Account:
   Username: [test_username]
   Password: [test_password]
   
   Key Features to Test:
   - Login and authentication
   - Dashboard analytics and charts
   - Stock management features
   - Multi-pharmacy switching
   - Data visualization
   
   The app provides real-time pharmacy performance metrics and business intelligence for pharmacy owners and managers.
   ```

3. **Contact Information**:
   - Provide support contact details
   - Include email and phone number
   - Ensure contact is available during review

### Step 9: App Privacy
1. **Privacy Policy**:
   - Upload or link to privacy policy
   - Ensure it covers all data collection
   - Include contact information

2. **Data Collection**:
   - Complete App Privacy questionnaire
   - Be honest about data collection
   - Provide clear explanations

## Phase 5: Final Review & Submission (Week 3)

### Step 10: Final Checklist
1. **App Information Complete**:
   - [ ] App name and subtitle
   - [ ] Description and keywords
   - [ ] Support and privacy URLs
   - [ ] Screenshots uploaded
   - [ ] App icon uploaded

2. **Build Ready**:
   - [ ] Build uploaded successfully
   - [ ] No processing errors
   - [ ] Build version matches app.json

3. **Review Information**:
   - [ ] Demo account provided
   - [ ] Review notes complete
   - [ ] Contact information current

### Step 11: Submit for Review
1. **Review Submission**:
   - Double-check all information
   - Ensure no placeholder content
   - Verify all links work

2. **Submit**:
   - Click "Submit for Review"
   - Confirm submission
   - Note submission date

3. **Monitor Status**:
   - Check review status daily
   - Typical review time: 24-48 hours
   - Be prepared for questions

## Phase 6: Post-Submission (Week 3-4)

### Step 12: Review Process
1. **Review Status**:
   - **Waiting for Review**: Initial status
   - **In Review**: Apple team reviewing
   - **Ready for Sale**: Approved
   - **Rejected**: Issues found

2. **If Approved**:
   - Set release type (automatic or manual)
   - Plan launch marketing
   - Monitor app performance

3. **If Rejected**:
   - Read rejection reasons carefully
   - Fix all issues mentioned
   - Resubmit with corrections
   - Don't panic - rejections are common

### Step 13: Launch Preparation
1. **Release Strategy**:
   - Choose automatic or manual release
   - Plan marketing campaign
   - Prepare support documentation

2. **Post-Launch**:
   - Monitor user reviews
   - Respond to feedback
   - Plan future updates
   - Track app performance

## Timeline Summary

- **Week 1**: Apple Developer setup, App Store Connect configuration
- **Week 2**: Visual assets, build creation, upload
- **Week 3**: Review submission, monitoring
- **Week 4**: Launch or resubmission if needed

## Common Issues & Solutions

### Build Issues
- **Bundle ID Mismatch**: Ensure app.json matches App Store Connect
- **Version Conflicts**: Increment build number for each submission
- **Missing Permissions**: Add usage descriptions for all permissions

### Review Issues
- **Incomplete Information**: Fill out all required fields
- **Broken Links**: Test all URLs before submission
- **Missing Screenshots**: Upload all required screenshot sizes

### Launch Issues
- **Release Delays**: Manual release can take 24 hours
- **App Store Search**: Keywords and description affect discoverability
- **User Support**: Be prepared for user questions and feedback

## Success Tips

1. **Start Early**: Don't wait until last minute
2. **Test Thoroughly**: Ensure app works perfectly before submission
3. **Be Patient**: Review process takes time
4. **Follow Guidelines**: Stick to Apple's App Store guidelines
5. **Prepare for Rejection**: Have a plan for addressing issues
6. **Document Everything**: Keep records of all submissions and changes

## Support Resources

- **Apple Developer Support**: [developer.apple.com/support](https://developer.apple.com/support)
- **App Store Connect Help**: [help.apple.com/app-store-connect](https://help.apple.com/app-store-connect)
- **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
- **Community Forums**: [forums.expo.dev](https://forums.expo.dev)

---

**Good luck with your App Store submission! Remember, the first submission is often the most challenging, but persistence pays off.** 