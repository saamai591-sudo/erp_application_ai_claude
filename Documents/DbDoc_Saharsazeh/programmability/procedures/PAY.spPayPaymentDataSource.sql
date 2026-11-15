
CREATE   PROCEDURE [PAY].spPayPaymentDataSource
(
    @FromCalendarMonthID INT,
    @CalcTypeIDs NVARCHAR(MAX),
    @SelectedBranches NVARCHAR(MAX),
    @SelectedPersonels NVARCHAR(MAX),
    @TableName NVARCHAR(MAX),
    @ToCalendarMonthID INT = @FromCalendarMonthID,
    @SelectedCalendarMonth NVARCHAR(MAX) = Null
)
AS
DECLARE @Culture VARCHAR(25),
        @CultureNo TINYINT,
        @NeedConfirm NVARCHAR(6),
        @StartDate DATE,
        @EndDate DATE,
        @Query NVARCHAR(MAX);

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT @NeedConfirm = c.ConfigValue
FROM cfg.[Configuration] AS c
WHERE c.ConfigKey = 'AgreementNeedConfirm';

SELECT rfcst.[value] AS CalculationTypeId
INTO #calcTypes
FROM cfg.R_FnCommaStr2Table(@CalcTypeIDs) AS rfcst;


SELECT rfcst.[value] AS BranchID
INTO #SelBranches
FROM cfg.R_FnCommaStr2Table(@SelectedBranches) AS rfcst;


SELECT rfcst.[value] AS CalendarMonthID
INTO #SelCalendarMonth
FROM cfg.R_FnCommaStr2Table(@SelectedCalendarMonth) AS rfcst;


SELECT LEFT(VALUE, CHARINDEX('-', [value], 1) - 1) AS CalcTypeID,
       SUBSTRING([value], CHARINDEX('-', [value], 1) + 1, LEN(VALUE)) PersonelID
INTO #SelPersonel
FROM CFG.R_FnCommaStr2Table(@SelectedPersonels);




SELECT PersonelID
INTO #JustPersonel
FROM #SelPersonel
GROUP BY PersonelID;

SELECT * into #vwCompanyAccess
FROM cfg.vwCompanyAccess AS vca

SELECT p.* into #Personel
FROM hrm.Personel AS p
join #vwCompanyAccess AS vca on p.CompanyID = vca.CompanyID
left join #JustPersonel AS jp on jp.PersonelID = p.PersonelID
WHERE (@SelectedPersonels is NULL or jp.PersonelID is NOT NULL)

SELECT @StartDate = cm.StartDate
FROM HRM.CalendarMonth cm
WHERE cm.CalendarMonthID = @FromCalendarMonthID;

SELECT @EndDate = cm.EndDate
FROM HRM.CalendarMonth cm
WHERE cm.CalendarMonthID = @ToCalendarMonthID;


SELECT cm.* 
INTO   #CalendarMonth
FROM   hrm.CalendarMonth AS cm
       left JOIN #SelCalendarMonth scm
            ON  cm.CalendarMonthID = scm.CalendarMonthID
WHERE  cm.StartDate >= @StartDate
       AND cm.EndDate <= @EndDate
       AND (
               @SelectedCalendarMonth is NULL
               OR scm.CalendarMonthID is NOT NULL
           );



SELECT T.PersonelID,
       T.BranchID,
       EmploymentTypeID,
       CostCenterID,
       WorkPlaceID
INTO #validAgg
FROM
(
    SELECT a.*,
           ROW_NUMBER() OVER (PARTITION BY a.PersonelID
                              ORDER BY (CASE
                                            WHEN @NeedConfirm = 'False' THEN
                                                a.IssueDate
                                            ELSE
                                                a.ConfirmDate
                                        END
                                       ) DESC
                             ) AS Rno
    FROM hrm.Agreement a
        INNER JOIN hrm.EmploymentType AS et
            ON et.EmploymentTypeID = a.EmploymentTypeID
        INNER JOIN Cfg.CostCenter AS cc
            ON cc.CostCenterID = a.CostCenterID
        INNER JOIN hrm.WorkPlace AS wp
            ON wp.WorkPlaceID = a.WorkPlaceID
        LEFT JOIN #SelBranches sb
            ON a.BranchID = sb.BranchID
        JOIN #Personel sp
            ON a.PersonelID = sp.PersonelID
    WHERE (CASE
               WHEN @NeedConfirm = 'False' THEN
                   a.IssueDate
               ELSE
                   a.ConfirmDate
           END
          ) <= @EndDate
          AND
          (
              @SelectedBranches IS NULL
              OR sb.BranchID IS NOT NULL
          )
          
) T
WHERE Rno = 1;


SET @Query
    = N'create Table ' + @TableName
      + N'
	    (BranchID int,
	    CalendarMonthID int,
	    CalculationResultID bigint,
	    EmploymentTypeID int not null,
	    WorkPlaceID int not null,
	    CostCenterID int not null,
	    PersonelID int not null,
	    ParameterID int Not Null,
	    Amount Decimal(30,4) Not Null,
	    PayType tinyint,
	    Paid Decimal(30,4),
	    PaymentReceiptID int,
	    Number int,
		Date date,
	    CalculationPersonelID int,
	    ManualReceiptID int,
	    DebitCreditID int
	   
	    )';


EXEC (@Query);


SET @Query
    = N'Insert into ' + @TableName
      + N'
	SELECT 
	va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			cr.[Value] ,
			Null,
			0 as Paid,
			null as PaymentReceiptID ,
			null as Number ,
			null as Date,
			null as CalculationPersonelID ,
			null as ManulReceiptID ,
			null as	DebitCreditID 

	     
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
	and cm.StartDate between @StartDate and @EndDate
	
	 ';

EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate;


SET @Query
    = N'Insert into ' + @TableName
      + N'
		SELECT va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			0 as Amount ,
			0 as PayType,
			ppi.Value as Paid,
			pr.PaymentReceiptID as PaymentReceiptID ,
			pr.Number as Number ,
			pr.Date as Date ,
			null as CalculationPersonelID ,
			null as ManulReceiptID ,
			null as	DebitCreditID 	 
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID	
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	JOIN pay.PayPreparingItem AS ppi ON cp.PersonelID=ppi.PersonnelID AND cr.ParameterID=ppi.ParameterID
	JOIN pay.PayPreparing AS pp ON ppi.PayPreparingID=pp.PayPreparingID AND pp.CalendarMonthID=cp.CalendarMonthID
	JOIN fin.PaymentSubject AS ps ON ps.PayPreparingID = pp.PayPreparingID
	JOIN fin.PaymentReceipt AS pr ON pr.PaymentReceiptID = ps.PaymentReceiptID'
      + CASE
            WHEN @SelectedPersonels IS NOT NULL THEN
                '
	join #SelPersonel sp on cp.personelID=sp.PersonelID and cp.CalculationTypeID=sp.CalcTypeID '
            ELSE
                ''
        END
      + N'
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
	and cm.StartDate between @StartDate and @EndDate
	';
PRINT @Query;
EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date,
                   @SelectedPersonels Nvarchar(max)',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate,
                   @SelectedPersonels = @SelectedPersonels;


SET @Query =
	N'Insert into ' + @TableName
      +
	N'
		SELECT va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			0 as Amount ,
			1 as PayType,
			sc.[Value]-sc.Paid as Paid,
			Null as PaymentReceiptID ,
			Null as PaymentReceiptNumber ,
			Null as PaymentReceiptDate ,
			cp.CalculationPersonelID as CalculationPersonelID ,
			null as ManulReceiptID ,
			null as	DebitCreditID 	 
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID	
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	JOIN pay.SettlementCalculation  AS sc on  sc.BaseCalculationPersonelID = cp.CalculationPersonelID
   '         + CASE
                   WHEN @SelectedPersonels IS NOT NULL THEN
                       '
	join #SelPersonel sp on cp.personelID=sp.PersonelID and cp.CalculationTypeID=sp.CalcTypeID '
                   ELSE
                       ''
               END
      + N' 
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
	and (sc.[Value]-sc.Paid)<>0
and cm.StartDate between @StartDate and @EndDate
	';

EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date,
                   @SelectedPersonels Nvarchar(max)',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate,
                   @SelectedPersonels = @SelectedPersonels;

--------Payroll has been paid in payment receipt Directly---------------------

SET @Query
    = N'Insert into ' + @TableName
      + N'
		SELECT va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			0 as Amount ,
			0 as PayType,
			ps.Amount as Paid,
			ps.PaymentReceiptID as PaymentReceiptID ,
			pr.Number as PaymentReceiptNumber ,
			pr.Date as PaymentReceiptDate ,
			Null as CalculationPersonelID ,
			null as ManulReceiptID ,
			null as	DebitCreditID 	 
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	join fin.PaymentSubject ps on cr.CalculationResultID=ps.CalculationResultID
	join fin.PaymentReceipt pr on ps.PaymentReceiptID=pr.PaymentReceiptID
     '       + CASE
                   WHEN @SelectedPersonels IS NOT NULL THEN
                       '
	join #SelPersonel sp on cp.personelID=sp.PersonelID and cp.CalculationTypeID=sp.CalcTypeID '
                   ELSE
                       ''
               END
      + N'      
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
	and cm.StartDate between @StartDate and @EndDate
	';

EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date,
                   @SelectedPersonels Nvarchar(max)',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate,
                   @SelectedPersonels = @SelectedPersonels;


--------Payroll has been paid in debit credit note Directly---------------------

SET @Query
    = N'Insert into ' + @TableName
      + N'
		SELECT va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			0 as Amount ,
			2 as PayType,
			ps.Amount as Paid,
			Null as PaymentReceiptID ,
			pr.Number as PaymentReceiptNumber ,
			pr.Date as PaymentReceiptDate ,
			Null as CalculationPersonelID ,
			null as ManulReceiptID ,
			pr.DebitCreditNoteID as	DebitCreditID 	 
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	join CFG.DebitCreditNoteItem ps on cr.CalculationResultID=ps.CalculationResultID and ps.type=0
	join CFG.DebitCreditNote pr on ps.DebitCreditNoteID=pr.DebitCreditNoteID
     '       + CASE
                   WHEN @SelectedPersonels IS NOT NULL THEN
                       '
	join #SelPersonel sp on cp.personelID=sp.PersonelID and cp.CalculationTypeID=sp.CalcTypeID '
                   ELSE
                       ''
               END
      + N'      
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
and cm.StartDate between @StartDate and @EndDate
	';

EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date,
                   @SelectedPersonels Nvarchar(max)',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate,
                   @SelectedPersonels = @SelectedPersonels;

--------Payroll has been paid in Manual Receipt---------------------

SET @Query
    = N'Insert into ' + @TableName
      + N'
		SELECT va.BranchID,
	cp.CalendarMonthID,
	cr.CalculationResultID,
			va.EmploymentTypeID,
			va.WorkPlaceID,
			va.CostCenterID,
			cp.PersonelID,
			p.ParameterID,
			0 as Amount ,
			3 as PayType,
			mr.Amount as Paid,
			Null as PaymentReceiptID ,
			mr.Number as PaymentReceiptNumber ,
			mr.Date as PaymentReceiptDate ,
			Null as CalculationPersonelID ,
			mr.ManualReceiptID as ManulReceiptID ,
			null as	DebitCreditID 	 
	  FROM pay.CalculationResult AS cr 
	JOIN pay.Parameter AS p ON p.ParameterID = cr.ParameterID
	JOIN pay.CalculationPersonel AS cp ON cp.CalculationPersonelID = cr.CalculationPersonelID
	join #CalendarMonth cm on cp.CalendarMonthID = cm.CalendarMonthID
	JOIN #validAgg AS va ON cp.PersonelID=va.PersonelID
	join #calcTypes ct ON cp.CalculationTypeID=ct.CalculationTypeId
	join CFG.ManualReceipt mr on mr.CalculationResultID=cr.CalculationResultID
    '        + CASE
                   WHEN @SelectedPersonels IS NOT NULL THEN
                       '
	join #SelPersonel sp on cp.personelID=sp.PersonelID and cp.CalculationTypeID=sp.CalcTypeID '
                   ELSE
                       ''
               END
      + N'      
	WHERE p.SystemName IN (''khales'',''SettlementParam'')
	and cm.StartDate between @StartDate and @EndDate
	';
EXEC sp_executesql @Query,
                   N'@StartDate date,
                   @EndDate date,
                   @SelectedPersonels Nvarchar(max)',
                   @StartDate = @StartDate,
                   @EndDate = @EndDate,
                   @SelectedPersonels = @SelectedPersonels;

