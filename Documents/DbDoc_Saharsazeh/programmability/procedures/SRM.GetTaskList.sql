
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 7/8/2018 10:12:58 AM
 ************************************************************/

CREATE PROCEDURE [SRM].[GetTaskList]
(@UserId INT, @TimeId INT, @StateIds VARCHAR(100))
AS
	DECLARE @ToDay         DATE,
	        @Startweek     DATE,
	        @EndWeek       DATE
	
	SELECT @ToDay = CAST(GETDATE() AS DATE)
	SELECT @Startweek = DATEADD(dd, -2, DATEADD(ww, DATEDIFF(ww, 0, GETDATE()), 0))
	SELECT @EndWeek = DATEADD(dd, 7, @Startweek)
	
	
	DECLARE 
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10)
	
	
	
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
	    
	    
	
	SELECT *,
	       CASE t.TaskType
	            WHEN 1 THEN N'اقدام'
	            WHEN 2 THEN N'ایمیل'
	            ELSE N'تماس' END  AS TaskTypeString,
	      CFG.GetCLRSaturnDate(
	      	
	      	CAST(TaskDate AS DATETIME) + CAST(TaskTime AS DATETIME)
	      
	      	
	      	,@DateFormat  , 1,@DateType) AS TaskDateString  
	FROM   srm.Task           AS t
	       INNER JOIN cfg.R_FnCommaStr2Table(@StateIds) AS rfcst
	            ON  rfcst.[value] = t.[State]
	WHERE  t.Assignee = @UserId
	       AND (
	               @TimeId = 0
	               OR (@TimeId = 1 AND CAST(t.TaskDate AS DATE) = @ToDay)
	               OR (
	                      @TimeId = 2
	                      AND CAST(t.TaskDate AS DATE) >= @Startweek
	                      AND CAST(t.TaskDate AS DATE) <= @EndWeek
	                  )
	           )
	    
