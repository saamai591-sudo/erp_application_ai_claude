-------------------------------------
CREATE   PROCEDURE [FLW].spWorkFlowManagerReview_Note
(@ProcessInstanceID INT)
AS
BEGIN
     DECLARE @userId INT,
            @Culture NVARCHAR(20),
            @DateType VARCHAR(10),
		    @CultureNo tinyint,
            @DateFormat VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();
    SET @userId = CFG.GetuserID();


	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;
    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

      SELECT DISTINCT
              wai.AppInstanceID     
             ,c.CommentID
             ,c.DocumentName
             ,c.DocumentID
             ,c.Description
             ,c.Version
             ,c.Creator
             ,c.CreationDate
             ,case @CultureNo 
                        when 1 then  u.Name
                        else u.Name2
               end as CreatorName
             ,CFG.GetCLRSaturnDate(c.CreationDate, @DateFormat, 1, @DateType) AS CreationDateTime
             ,CAST(0 AS BIT) as IsLastComment
    FROM [FLW].WfActivityInstance AS wai         
          JOIN cfg.Comment c
              ON wai.AppInstanceID = c.DocumentID AND wai.AppName = c.DocumentName
          join cfg.[User] u on c.Creator = u.UserID
          WHERE wai.ProcessInstanceID = @ProcessInstanceID
          ORDER BY c.CreationDate DESC
END;
