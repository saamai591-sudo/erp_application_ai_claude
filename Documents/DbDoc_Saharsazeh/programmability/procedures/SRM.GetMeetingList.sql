/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 7/10/2018 4:13:55 PM
 ************************************************************/

CREATE PROCEDURE [SRM].[GetMeetingList]
(@UserId INT, @TimeId INT, @StateIds VARCHAR(100))
AS
	DECLARE @ToDay         DATE,
	        @Startweek     DATE,
	        @EndWeek       DATE,
	        @TDate         DATETIME
	
	SELECT @ToDay = CAST(GETDATE() AS DATE)
	SELECT @TDate = GETDATE()
	
	SELECT @Startweek = DATEADD(dd, -2, DATEADD(ww, DATEDIFF(ww, 0, GETDATE()), 0))
	SELECT @EndWeek = DATEADD(dd, 7, @Startweek)
	
	
	DECLARE @DateType       TINYINT,
	        @DateFormat     VARCHAR(10)
	
	
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE cfg.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'  
	
	
	
	SELECT *
	FROM   (
	           SELECT *,
	                  CFG.GetCLRSaturnDate(t.StartDate, @DateFormat, 0, @DateType) AS StartDateString,
	                  CONVERT(VARCHAR, startTime, 8) AS StartTimeString,
	                  CFG.ConvertToHourMinute(EstimateDuration) AS EstimateDurationString,
	                  CASE 
	                       WHEN CAST(StartDate AS DATETIME) + CAST(StartTime AS DATETIME) >
	                            @TDate THEN 0
	                       WHEN DATEADD(
	                                mi,
	                                t.EstimateDuration,
	                                CAST(StartDate AS DATETIME) +
	                                CAST(StartTime AS DATETIME)
	                            ) < @TDate THEN 2
	                       ELSE 1
	                  END          AS [Status]
	           FROM   srm.Meeting  AS t
	           WHERE  t.MeetingID IN (SELECT mu.MeetingID
	                                  FROM   srm.MeetingUser AS mu
	                                  WHERE  mu.UserID = @UserId)
	                  AND (
	                          @TimeId = 0
	                          OR (@TimeId = 1 AND CAST(t.StartDate AS DATE) = @ToDay)
	                          OR (
	                                 @TimeId = 2
	                                 AND CAST(t.StartDate AS DATE) >= @Startweek
	                                 AND CAST(t.StartDate AS DATE) <= @EndWeek
	                             )
	                      )
	       )T
	       INNER JOIN cfg.R_FnCommaStr2Table(@StateIds) AS rfcst
	            ON  rfcst.[value] = t.[Status]
	    
