Feature: Video Annotations
  As a movement enthusiast
  I want to annotate movement videos with form corrections and tips
  So that I can improve my technique and help others

  Background:
    Given I am logged in as a user
    And there is a movement video available

  Scenario: Create a form correction annotation
    Given I am viewing a movement video
    When I click on the "Add Annotation" button
    And I select "Form Correction" as the annotation type
    And I set the timestamp to 15.5 seconds
    And I enter "Keep your back straight and engage your core" as the content
    And I click "Save Annotation"
    Then the annotation should be saved successfully
    And the annotation should appear at 15.5 seconds in the video
    And the annotation should be visible to other users

  Scenario: Create a technique tip annotation
    Given I am viewing an exercise video
    When I click on the "Add Annotation" button
    And I select "Technique Tip" as the annotation type
    And I set the timestamp range from 8.2 to 12.7 seconds
    And I enter "Focus on controlled movement and full range of motion" as the content
    And I mark the annotation as private
    And I click "Save Annotation"
    Then the annotation should be saved successfully
    And the annotation should be visible only to me
    And the annotation should span from 8.2 to 12.7 seconds

  Scenario: Add visual coordinates to annotation
    Given I am viewing an exercise video
    When I click on the "Add Annotation" button
    And I select "Form Correction" as the annotation type
    And I set the timestamp to 22.1 seconds
    And I click on the video frame to set coordinates
    And I enter "Your knees should be aligned with your toes" as the content
    And I click "Save Annotation"
    Then the annotation should be saved with visual coordinates
    And the annotation should highlight the specific area on the video

  Scenario: Edit existing annotation
    Given I have created an annotation
    When I click on the "Edit" button for the annotation
    And I change the content to "Updated form correction advice"
    And I click "Save Changes"
    Then the annotation should be updated successfully
    And the new content should be displayed

  Scenario: Delete annotation
    Given I have created an annotation
    When I click on the "Delete" button for the annotation
    And I confirm the deletion
    Then the annotation should be removed from the video
    And the annotation should no longer be visible

  Scenario: Filter annotations by type
    Given there are multiple annotations on a video
    When I select "Form Correction" from the filter dropdown
    Then only form correction annotations should be visible
    And other annotation types should be hidden

  Scenario: Search annotations by content
    Given there are multiple annotations on a video
    When I enter "back straight" in the search box
    Then only annotations containing "back straight" should be displayed
    And other annotations should be filtered out

  Scenario: Export annotations
    Given there are multiple annotations on a video
    When I click on the "Export Annotations" button
    Then a JSON file should be downloaded
    And the file should contain all annotation data
    And the file should include timestamps and content

  Scenario: Share annotation with other users
    Given I have created a private annotation
    When I click on the "Share" button for the annotation
    And I enter a user's email address
    And I click "Send"
    Then the annotation should be shared with the specified user
    And the user should receive a notification

  Scenario: Rate annotation helpfulness
    Given I am viewing an annotation created by another user
    When I click on the "Helpful" button
    Then the helpfulness rating should increase
    And my rating should be recorded

  Scenario: Report inappropriate annotation
    Given I am viewing an annotation
    When I click on the "Report" button
    And I select "Inappropriate Content" as the reason
    And I provide additional details
    And I click "Submit Report"
    Then the report should be submitted to moderators
    And I should receive a confirmation message

  Scenario: Bulk edit annotations
    Given I have multiple annotations selected
    When I click on the "Bulk Edit" button
    And I change the visibility to "Public"
    And I click "Apply to All"
    Then all selected annotations should be updated
    And the changes should be applied to each annotation

  Scenario: Annotation analytics
    Given I have created multiple annotations
    When I view my annotation analytics
    Then I should see the total number of annotations created
    And I should see the number of helpful ratings received
    And I should see the number of users who viewed my annotations
    And I should see the most popular annotation types

  Scenario: Annotation moderation
    Given I am a moderator
    And there is a reported annotation
    When I review the reported annotation
    And I decide to remove it for violating guidelines
    And I click "Remove Annotation"
    Then the annotation should be removed from the video
    And the creator should be notified of the removal
    And the creator should have the option to appeal

  Scenario: Annotation collaboration
    Given multiple users are viewing the same video
    When User A creates an annotation
    And User B adds additional context to the same timestamp
    Then both annotations should be visible
    And users should see that multiple people contributed
    And the annotations should be linked together

  Scenario: Annotation versioning
    Given I have edited an annotation multiple times
    When I view the annotation history
    Then I should see all previous versions of the annotation
    And I should be able to revert to any previous version
    And I should see who made each change and when

  Scenario: Annotation notifications
    Given I am following a user who creates annotations
    When the user creates a new annotation
    Then I should receive a notification
    And the notification should include the video title and annotation type
    And I should be able to click to view the annotation

  Scenario: Annotation accessibility
    Given I am using a screen reader
    When I navigate through video annotations
    Then each annotation should have proper ARIA labels
    And the annotation content should be read aloud
    And I should be able to navigate between annotations using keyboard shortcuts

  Scenario: Annotation performance
    Given there are many annotations on a video
    When I scroll through the video timeline
    Then the annotations should load smoothly
    And there should be no lag or performance issues
    And the video playback should remain smooth

  Scenario: Annotation data export
    Given I have created multiple annotations across different videos
    When I request a data export of my annotations
    Then I should receive a comprehensive export
    And the export should include all annotation metadata
    And the export should be in a standard format (JSON/CSV)
    And the export should be available for download within 24 hours
