CREATE  FUNCTION HRM.fnGetActivePersonelInMonth
(
	@CalendarMonthID     INT,
	@Type                INT ---- For call from payroll pass 1 and for call from attendance pass 2
)
RETURNS @Result TABLE 
        (
            PersonelID INT NOT NULL,
            PartyID INT NOT NULL,
            Code NVARCHAR(100) NOT NULL,
            FullName NVARCHAR(1024) NOT NULL
        )
AS
  	
      
BEGIN
	DECLARE @StartDate     DATE,
	        @EndDate       DATE,
	        @Culture       NVARCHAR(100),
	        @CultureNo     TINYINT
	
	SET @Culture = cfg.GetuserCulture()	
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT @StartDate = CASE 
	                         WHEN @Type = 1 THEN cm.StartDate
	                         ELSE cm.AttendanceStartDate
	                    END,
	       @EndDate = CASE 
	                       WHEN @Type = 1 THEN cm.EndDate
	                       ELSE cm.AttendanceEndDate
	                  END
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarMonthID = @CalendarMonthID
	
	
	
	INSERT INTO @Result
	SELECT a.PersonelID,
	       p2.PartyID,
	       p.Code,
	       CASE @CultureNo
	            WHEN 1 THEN (p2.Title + ' ' + ISNULL(p2.LastName, ''))
	            WHEN 2 THEN (p2.Title2 + ' ' + ISNULL(p2.LastName2, ''))
	       END                AS FullName
	FROM   (
	           SELECT ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY cps.ChangeDate DESC) rno,
	                  a.AgreementID,
	                  cps.ChangeDate,
	                  a.PersonelID,
	                  cps.[STATUS]
	           FROM   hrm.Agreement      AS a
	                  JOIN hrm.ChangePersonelStatus AS cps
	                       ON  cps.AgreementID = a.AgreementID
	                  JOIN hrm.Personel  AS p
	                       ON  p.PersonelID = a.PersonelID
	           WHERE  cps.ChangeDate <= @EndDate
	       ) a
	       JOIN hrm.Personel  AS p
	            ON  p.PersonelID = a.PersonelID
	       JOIN cfg.Party     AS p2
	            ON  p2.PartyID = p.PartyID
	WHERE  a.rno = 1
	       AND (
	               a.[STATUS] = 5
	               OR (
	                      a.[STATUS] <> 5
	                      AND DATEADD (DAY,-1,a.ChangeDate) BETWEEN @StartDate AND @EndDate
	                  )
	       )
	       RETURN
END
