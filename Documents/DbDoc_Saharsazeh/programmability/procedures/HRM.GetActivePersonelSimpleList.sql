
---------------------------------------------------------
CREATE   PROCEDURE [HRM].GetActivePersonelSimpleList
(@Date Date, @calendarMonthId INT=null)
AS
	DECLARE @UserId        INT,
	        @StartDate     DATE,
	        @EndDate       DATE,
			@Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @UserId = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	
	IF @calendarMonthId IS NOT NULL AND @calendarMonthId<>0
	    SELECT @StartDate = cm.StartDate,
	           @EndDate = cm.EndDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  cm.CalendarMonthID = @calendarMonthId
	ELSE
	    SELECT @StartDate = cm.StartDate,
	           @EndDate = cm.EndDate
	    FROM   hrm.CalendarMonth AS cm
	    WHERE  @Date BETWEEN cm.StartDate AND cm.EndDate
	
	IF @calendarMonthId IS not NULL
	    SET @Date = GETDATE()
		
	IF @Date IS NULL
	    SET @Date = GETDATE()
	
	DECLARE @NeedConfirm BIT
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm';
	
		SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba			
	
	SELECT *
	INTO   #TT1
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @Startdate
	       )T1
	WHERE  Rno = 1
	
	SELECT *
	INTO   #TT2
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @Enddate
	       )T1
	WHERE  Rno = 1
	
	SELECT *
	INTO   #TInside
	FROM   (
	           SELECT cps.PersonelID,
	                  COUNT(*) AS cnt
	           FROM   hrm.ChangePersonelStatus cps
	           WHERE  cps.ChangeDate <= @Enddate
	                  AND cps.ChangeDate >= @StartDate
	                  AND cps.[STATUS] = 5
	           GROUP BY
	                  cps.PersonelID
	       )T1
	
	SELECT p.PersonelID,
	       P.PartyID,
	       P.Code,
	       P.FullName,
		   p.CompanyID
	FROM   (
	           SELECT p.PersonelID,
	                  p.PartyID,
	                  P.Code,
					  case @CultureNo
					       when 1 then (pa.Title + ' ' + ISNULL(pa.LastName, ''))
	                       when 2 then (pa.Title2 + ' ' + ISNULL(pa.LastName2, ''))
	                  end AS FullName,
					  p.CompanyID
	           FROM   HRM.Personel p
	                  INNER JOIN CFG.Party pa
	                       ON  p.PartyID = pa.PartyID
	                  LEFT JOIN #TT1 T
	                       ON  T.PersonelID = p.PersonelID
	                  LEFT JOIN #TT2 TEnd
	                       ON  TEnd.PersonelID = p.PersonelID
	                  LEFT JOIN #TInside TInside
	                       ON  TInside.PersonelID = p.PersonelID
	           WHERE  (TEnd.[Status] = 5 OR T.[Status] = 5 OR Tinside.cnt <> 0)
	       )P
	       INNER JOIN (
	                SELECT *,
	                       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS RNo
	                FROM   hrm.Agreement AS a
	                WHERE  a.IssueDate <= @Date
	                       AND a.ExecuteDate <= @Date
	                       AND (
	                               @NeedConfirm = 0
	                               OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @Date)
	                           )
	            )a
	            ON  a.PersonelID = p.PersonelID
	            AND a.RNo = 1
	            INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = a.BranchID;
