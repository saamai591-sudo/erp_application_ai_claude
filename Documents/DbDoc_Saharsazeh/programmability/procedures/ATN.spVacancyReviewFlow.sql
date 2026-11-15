
------------------------------------- 
CREATE   PROC ATN.spVacancyReviewFlow (@FromMonth INT, @ToMonth INT, @SelectedPersonVacancyNature NVARCHAR(500))
AS
BEGIN


  DECLARE @StartDate DATE
		 ,@EndDate DATE

  SELECT
	@StartDate = cm.StartDate
  FROM hrm.CalendarMonth AS cm
  WHERE cm.CalendarMonthID = @FromMonth

  SELECT
	@EndDate = cm.EndDate
  FROM hrm.CalendarMonth AS cm
  WHERE cm.CalendarMonthID = @ToMonth

  PRINT SYSDATETIME()

  SELECT
	SUBSTRING(@SelectedPersonVacancyNature, 1, CHARINDEX('|', @SelectedPersonVacancyNature, 1) - 1) PersonelID
   ,SUBSTRING(@SelectedPersonVacancyNature, CHARINDEX('|', @SelectedPersonVacancyNature, 1) + 1, LEN(@SelectedPersonVacancyNature)) VacancyNatureID INTO #SelectedPersonel;

  PRINT SYSDATETIME()


  DROP TABLE
  IF EXISTS #Item
  CREATE TABLE #Item (
	PersonelID INT
   ,VacancyNatureID INT
   ,[Type] NVARCHAR(50)
   ,DocumentID INT
   ,[Date] DATE
   ,[Value] DECIMAL(36, 10)
  )

  INSERT INTO #Item (PersonelID,
  VacancyNatureID,
  [Type],
  DocumentID,
  [Date],
  [Value])
	SELECT
	  vvc.PersonelID
	 ,vvc.VacancyNatureID
	 ,'FirstRemain'
	 ,NULL
	 ,@StartDate
	 ,SUM(vvc.AddedVacancy - vvc.DeductedVacancy) FirstRemain
	FROM atn.vwVacancyCardex AS vvc
	JOIN #SelectedPersonel sp
	  ON vvc.PersonelID = sp.PersonelID
		AND vvc.VacancyNatureID = sp.VacancyNatureID
	WHERE (
	vvc.[Date] < @StartDate
	OR (
	vvc.[Document] = 'VacancyEstablishment'
	AND vvc.[Date] <= @EndDate
	))
	GROUP BY vvc.PersonelID
			,vvc.VacancyNatureID

	OPTION (RECOMPILE)

  PRINT SYSDATETIME()


  INSERT INTO #Item (PersonelID,
  VacancyNatureID,
  [Type],
  DocumentID,
  [Date],
  [Value])
	SELECT
	  vvc.PersonelID
	 ,vvc.VacancyNatureID
	 ,vvc.Document
	 ,vvc.DocumentID
	 ,vvc.[Date]
	 ,vvc.AddedVacancy - vvc.DeductedVacancy
	FROM atn.vwVacancyCardex AS vvc
	JOIN #SelectedPersonel sp
	  ON vvc.PersonelID = sp.PersonelID
		AND vvc.VacancyNatureID = sp.VacancyNatureID
	WHERE vvc.[Date] BETWEEN @StartDate AND @EndDate
	AND vvc.[Document] <> 'VacancyEstablishment'

	OPTION (RECOMPILE)

  CREATE TABLE #Translation (
	[Type] NVARCHAR(50)
   ,Culture NVARCHAR(10)
   ,[Value] NVARCHAR(250)
  )

  INSERT INTO #Translation ([Type],
  Culture,
  [Value])
	VALUES ('FirstRemain', 'fa', N'اول دوره'),
	('FirstRemain', 'en', N'FirstRemain'),
	('LeaveRequest', 'fa', N'درخواست مرخصي'),
	('LeaveRequest', 'en', N'LeaveRequest'),
	('VacancyEdition', 'fa', N'اصلاح مرخصي'),
	('VacancyEdition', 'en', N'VacancyEdition'),
	('AssignableValue', 'fa', N'تخصيص يافته'),
	('AssignableValue', 'en', N'AssignableValue')


  DECLARE @DateFormat NVARCHAR(20)
		 ,@DateType INT
		 ,@Culture NVARCHAR(10)

  SET @DateFormat = cfg.GetCurrentUserDateFormat()
  SET @DateType = cfg.GetCurrentUserDateType()
  SET @Culture = cfg.GetuserCulture()


  EXEC (N'SELECT 
		tr.Value as Type,
		cfg.GetCLRSaturnDate(i.[Date],''' + @DateFormat + N''',0,' + @DateType + N') Date,
		CFG.ConvertToHourMinute (i.[Value]) as Value ,
		DocumentID,
		CFG.ConvertToHourMinute (SUM(i.[Value]) over (PARTITION By i.PersonelID,i.VacancyNatureID ORDER BY i.Date )) RemainInLine
		FROM   #Item                    AS i
		join #Translation tr on i.Type = tr.Type and tr.Culture = ''' + @Culture + N'''')


END;
