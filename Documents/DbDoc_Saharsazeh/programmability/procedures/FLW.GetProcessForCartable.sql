---------------------------------------------------------
CREATE   PROCEDURE [FLW].GetProcessForCartable
(
    @ProcessGuID           VARCHAR(100) = NULL,
    @ProcessInstanceID     INT NULL = NULL,
    @CreatedUserID         INT NULL = NULL,
    @ProcessName           NVARCHAR(512) NULL = NULL,
    @InProgress            BIT NULL,
    @completed             BIT NULL
)
AS
BEGIN
	IF ( @InProgress = 1 AND @completed = 1 )
	BEGIN
		SET @InProgress = NULL
		SET @completed = NULL
	END

	IF (LTRIM(RTRIM(ISNULL(@ProcessGuID, ''))) = '')
		SET @ProcessGuID = NULL;

	DECLARE @culture				NVARCHAR(10) = CFG.GetuserCulture(),
			@UserID					INT,
	        @DateType				TINYINT,
	        @DateFormat				VARCHAR(10)

	SET @UserID = CFG.GetuserID();
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID;
	
	IF @DateType IS NULL
	BEGIN
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END;
	END

	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID;
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD';

	SELECT wai.ProcessInstanceID,
			wai.ActivityType,
			wai.CreatedByUserID
	INTO   #FlowCreator
	FROM   flw.WfActivityInstance wai
	WHERE  ActivityType = 1
			AND (@CreatedUserID IS NULL OR wai.CreatedByUserID = @CreatedUserID)
			

select * into #vwManagerSubordinates
from cfg.vwManagerSubordinates
		
	SELECT a.ProcessInstanceID,a.AssignedToUserID into #RelatedTasks 
	FROM (
		SELECT wt.ProcessInstanceID,wt.AssignedToUserID
	FROM flw.WfTasks AS wt
	GROUP BY wt.AssignedToUserID,wt.ProcessInstanceID
	union all
	select wt.ProcessInstanceID,-1 FROM flw.WfTasks AS wt
	GROUP BY wt.ProcessInstanceID
	union all
	SELECT wt.ProcessInstanceID,vms.ManagerUserID
	FROM flw.WfTasks AS wt
	join #vwManagerSubordinates vms on wt.AssignedToUserID = vms.SubordinateUserID
	GROUP BY vms.ManagerUserID,wt.ProcessInstanceID
		
	) a
	GROUP BY a.ProcessInstanceID,a.AssignedToUserID	
			

	;WITH LatestActivity AS (
		SELECT 
			ROW_NUMBER() OVER (PARTITION BY ai.ProcessInstanceID ORDER BY ai.ID DESC) RN,
			ai.ProcessInstanceID,
			ai.AppInstanceID,
			CASE ai.AppName
				WHEN 'QuantityOutgoing' THEN 'Outgoing'
				WHEN 'QuantityReturnedOutgoing' THEN 'ReturnedOutgoing'
				WHEN 'ReturnQuantityReceipt' THEN 'ReturnStockReceipt'
				WHEN 'QuantityReceipt' THEN 'StockReceipt'
				WHEN 'ContractComplement' THEN 'Contract'
				WHEN 'QuantityAssetReceipt' THEN 'AssetReceipt'
				WHEN 'QuantityAsset' THEN 'Asset'
				WHEN 'QuantityDestruction' THEN 'Destruction'
				WHEN 'QuantitySale' THEN 'Sale'
				WHEN 'QuantitySalvage' THEN 'Salvage'
				WHEN 'QuantityTransfer' THEN 'Transfer'
				ELSE ai.AppName
			END AS AppName,
			ai.ActivityName,
			ai.AssignedToUserIDs,
			ai.CreatedDateTime AS ProcessLastActionDate,
			ai.ActivityState,
			ai.ActivityGUID
		FROM FLW.WfActivityInstance ai
	)
	SELECT
			p.ProcessGUID,
			p.ID AS ProcessInstanceID,
			p.Version,
			COALESCE(NULLIF(LTRIM(RTRIM(wp.VersionTitle)), ''), N'v' + p.Version, p.Version) AS VersionTitle,
			COALESCE(la.AppInstanceID, p.AppInstanceID) AS AppInstanceID,
			COALESCE(la.AppName, p.AppName) AS AppName,
			la.ActivityName,
			la.AssignedToUserIDs,
			p.ProcessState,
			p.CreatedDateTime AS ProcessStartDate,
			COALESCE(la.ProcessLastActionDate, p.LastUpdatedDateTime, p.CreatedDateTime) AS ProcessLastActionDate,
			p.EndedDateTime,
			p.ProcessName,
			la.ActivityState,
			la.ActivityGUID,
			fc.CreatedByUserID
	INTO #src 
	FROM FLW.WfProcessInstance p
	join #RelatedTasks rt on p.ID = rt.ProcessInstanceID and rt.AssignedToUserID = @UserID 	
	LEFT JOIN FLW.WfProcess wp
		ON wp.ProcessGUID = p.ProcessGUID
		AND wp.Version = p.Version
	LEFT JOIN LatestActivity la
		ON la.ProcessInstanceID = p.ID
		AND la.RN = 1
	LEFT JOIN #FlowCreator fc
		ON fc.ProcessInstanceID = p.ID
	WHERE (
	               @ProcessInstanceID IS NULL
	               OR p.ID = @ProcessInstanceID
	           )
		AND (
				@ProcessGuID IS NULL
				OR p.ProcessGUID = @ProcessGuID
			)
		AND (
	        @ProcessName IS NULL
	        OR p.ProcessName LIKE '%' + @ProcessName + '%'
	    )
		AND
		(
			@InProgress IS NULL
	        OR 
			(@InProgress = 0 AND p.ProcessState != 2)
			OR 
			(@InProgress = 1 AND p.ProcessState = 2)
		)
		AND 
		(
			@completed IS NULL
	        OR 
			(@completed  = 0 AND p.ProcessState != 4)
			OR 
			(@completed = 1 AND p.ProcessState = 4)
		)	
		AND (
	        @CreatedUserID IS NULL
	        OR fc.CreatedByUserID = @CreatedUserID
	    )

	SELECT	s.ProcessGUID,
			s.ProcessInstanceID,
			s.Version,
			s.VersionTitle,
			s.AppInstanceID,
			s.AppName,
			s.ActivityName,
			CFG.GetCLRSaturnDate(s.ProcessStartDate, @DateFormat, 0, @DateType)  AS ProcessStartDate,
			CFG.GetCLRSaturnDate(s.ProcessLastActionDate, @DateFormat, 0, @DateType)  AS ProcessLastActionDate,
			CFG.GetCLRSaturnDate(s.EndedDateTime, @DateFormat, 0, @DateType)  AS ProcessEndDate,
			s.ProcessName,
			dti.[Value] AS FormTitle,
			p.[Name] AS AssignedUserName, 
			p.Name2 AS AssignedUserName2 ,
			cfg.ConvertToDayHourMinute(DATEDIFF(MINUTE, s.ProcessStartDate ,  ISNULL(s.EndedDateTime, GETDATE()) ), 1440) ElapsedTime
	FROM #src s
	LEFT JOIN (
		SELECT	ProcessInstanceID,
				STRING_AGG( u.[Name], ',') AS [Name],
				STRING_AGG( u.[Name2], ',') AS [Name2]
		FROM #src ai
		CROSS APPLY STRING_SPLIT(ai.AssignedToUserIDs, ',') b
		LEFT JOIN CFG.[User] u
			ON u.UserID = b.[Value]
		WHERE ai.AssignedToUserIDs IS NOT NULL
		GROUP BY ProcessInstanceID
	) p
		ON p.ProcessInstanceID = s.ProcessInstanceID
	LEFT JOIN MDT.DmdEntity AS de
		ON de.Name = s.AppName
	OUTER APPLY (
		SELECT TOP (1) dtiInner.[Value]
		FROM MDT.DmdRelatedEntityTranslate AS dret
		INNER JOIN MDT.DmdTranslateItem AS dtiInner
			ON dtiInner.ID = dret.DmdTranslateItemID
		WHERE dret.DmdEntityID = de.ID
			AND (
				@culture IS NULL
				OR dtiInner.Culture = @culture
			)
	) dti
END;
