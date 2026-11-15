
------------------------------------- START #7163
CREATE     PROCEDURE [PAY].[GetItemsForPayPreparing]
(
  @PayrollPaymentTypeID INT,
  @CalendarMonthId      INT,
  @branchId             INT,
  @OrganizationItemId   INT    =NULL,
  @Percent              TINYINT=NULL,
  @BanckBranchId        INT    =NULL
)

--WITH ENCRYPTION
AS
BEGIN

    DECLARE
      @calculationDate      DATE,
      @calculationStartDate DATE,
      @NeedConfirm          BIT,
      @cultureNo            INT,
      @precisionCount       INT,
      @culture              NVARCHAR(10);

    SET @culture=CFG.GetuserCulture( );

    DECLARE
      @lastAggreement TABLE
    (
      PersonelID       INT NOT NULL,
      BranchID         INT NULL,
      AgreementID      INT NULL,
      EmploymentTypeId INT NULL,
      WorkPlaceID      INT NULL,
      CostCenterId     INT NULL);

    SET @precisionCount=CFG.GetBaseCurrencyPrecision( );

    SELECT @cultureNo=ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture=@culture;

    SELECT @NeedConfirm=c.ConfigValue
    FROM CFG.Configuration c
    WHERE c.ConfigKey='AgreementNeedConfirm';

    SELECT @calculationDate=cm.EndDate,
           @calculationStartDate=cm.StartDate
    FROM HRM.CalendarMonth cm
    WHERE cm.CalendarMonthID=@CalendarMonthId;

    DROP TABLE IF EXISTS #Personles

    SELECT x.PersonelID,
           x.BankBranchID,
           x.Date
    INTO #Personles
    FROM (SELECT o.PersonelID,
                 pa.BankBranchID,
                 pa.Date,
                 ROW_NUMBER( ) OVER (PARTITION BY o.PersonelID ORDER BY isnull(pa.Date,'1970-01-01') DESC) AS rn
      FROM 
	  hrm.Personel o
	  left join 
	  HRM.PersonelAccount pa on o.PersonelID = pa.PersonelID
      WHERE (@BanckBranchId IS NULL  OR pa.BankBranchID=@BanckBranchId)
            AND (pa.date is null or pa.Date<=@calculationDate)) x
    WHERE x.rn=1;


    INSERT @lastAggreement
    (PersonelID,
     BranchID,
     AgreementID,
     EmploymentTypeId,
     WorkPlaceID,
     CostCenterId)
           SELECT T.PersonelID,
                  T.BranchID,
                  T.AgreementID,
                  T.EmploymentTypeID,
                  T.WorkPlaceID,
                  T.CostCenterID
           FROM (SELECT a.AgreementID,
                        a.EmploymentTypeID,
                        a.WorkPlaceID,
                        a.CostCenterID,
                        a.PersonelID,
                        a.ExpireDate,
                        a.BranchID,
                        ROW_NUMBER( ) OVER (PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
             FROM HRM.Agreement a
             WHERE a.ExecuteDate<=@calculationDate
                   AND (
                           @NeedConfirm=0
                           OR (
                                   a.ConfirmDate IS NOT NULL
                                   AND a.ConfirmDate<=@calculationDate
                           )
                   )
                   AND a.IssueDate<=@calculationDate) T
    JOIN
    #Personles p
    ON t.PersonelID=p.PersonelID
           WHERE T.Rno=1
                 AND (
                      T.ExpireDate IS NULL
                      OR T.ExpireDate>@calculationStartDate
                 );

    DROP TABLE IF EXISTS #parameters;
    DROP TABLE IF EXISTS #result;

    SELECT pptp.ParameterID
    INTO #parameters
    FROM PAY.PayrollPaymentTypeParameter AS pptp
    WHERE pptp.PayrollPaymentTypeID=@PayrollPaymentTypeID;

    ---this part is for payments that require organizationitem
    SELECT ao.AgreementID,
           la.PersonelID,
           oi.OrganizationID,
           ao.OrganizationItemID
    INTO #agrements
    FROM @lastAggreement AS la
JOIN
HRM.AgreementOrganization AS ao
ON ao.AgreementID=la.AgreementID
JOIN
HRM.OrganizationItem AS oi
ON oi.OrganizationItemID=ao.OrganizationItemID
    WHERE la.BranchID=@branchId
    UNION ALL
    --This part is for payments that do not require organizationitem
    SELECT la.AgreementID,
           la.PersonelID,
           NULL,
           NULL
    FROM @lastAggreement AS la
    WHERE la.BranchID=@branchId

    SELECT CalculationPersonelID,
           cp.PersonelID,
           cp.CalendarMonthID
    INTO #a
    FROM #agrements ag
JOIN
PAY.CalculationPersonel AS cp
ON cp.PersonelID=ag.PersonelID
    WHERE ISNULL( ag.OrganizationItemID, 0 )=ISNULL( @OrganizationItemId, 0 )

    SELECT cp.PersonelID,
           cr.ParameterID,
           ROUND( SUM( cr.Value ), @precisionCount ) AS [Value]
    INTO #result
    FROM PAY.CalculationResult AS cr
JOIN
#a AS cp
ON cr.CalculationPersonelID=cp.CalculationPersonelID
JOIN
PAY.ParameterValueType AS pvt
ON pvt.ParameterValueTypeID=cr.ParameterValueTypeID
JOIN
#parameters AS p
ON p.ParameterID=cr.ParameterID
    WHERE pvt.EngName IN ('Value', 'BackPayValue')
          AND cp.CalendarMonthID=@CalendarMonthId
    GROUP BY cp.PersonelID,
             cr.ParameterID;

    SELECT i.PersonnelID,
           i.ParameterID,
           SUM( i.Value ) Value
    INTO #LastFetched
    FROM PAY.PayPreparingItem i
JOIN
PAY.PayPreparing h
ON i.PayPreparingID=h.PayPreparingID
    WHERE h.CalendarMonthID=@CalendarMonthId
    GROUP BY i.PersonnelID,
             i.ParameterID;

    SELECT T.PersonelVoucherSettingID,
           T.PersonelID,
           T.PayrollAccGroupID,
           T.MissionOrganizationDlId
    INTO #lastVoucherSetting
    FROM (SELECT pvs.*,
                 ROW_NUMBER( ) OVER (PARTITION BY pvs.PersonelID ORDER BY cm.StartDate DESC) AS Rno
      FROM PAY.PersonelVoucherSetting AS pvs
      INNER JOIN
      HRM.CalendarMonth AS cm
      ON cm.CalendarMonthID=pvs.CalendarMonthID
      WHERE cm.EndDate<=@calculationDate) T
    WHERE T.Rno=1;

    SELECT r.PersonelID AS PersonnelId,
           p.Code AS PersonnelCode,
           CASE @cultureNo
                    WHEN 2
                    THEN p3.Title2+' '+p3.LastName2
                    ELSE p3.Title+' '+p3.LastName
           END AS PersonnelName,
           p2.ParameterID AS ParameterId,
           CASE @cultureNo
                    WHEN 2
                    THEN p2.Title2
                    ELSE p2.Title
           END AS ParameterTitle,
           CASE
                    WHEN @Percent IS NULL
                    THEN r.[Value]-ISNULL( lf.Value, 0 )
                    ELSE ROUND( (r.[Value]-ISNULL( lf.Value, 0 ))*@Percent/100, @precisionCount )
           END [Value],
           CASE @cultureNo
                    WHEN 2
                    THEN et.Title2
                    ELSE et.Title
           END AS EmploymentTypeTitle,
           CASE @cultureNo
                    WHEN 2
                    THEN cc.Title2
                    ELSE cc.Title
           END AS CostCenterTitle,
           CASE @cultureNo
                    WHEN 2
                    THEN pos.Title2
                    ELSE pos.Title
           END AS WorkPlaceTitle,
           CASE @cultureNo
                    WHEN 2
                    THEN pag.Title2
                    ELSE pag.Title
           END AS AccGroupTitle
    FROM #result AS r
JOIN
HRM.Personel AS p
ON p.PersonelID=r.PersonelID
JOIN
@lastAggreement lg
ON lg.PersonelID=p.PersonelID
LEFT JOIN
#lastVoucherSetting AS pvs
ON pvs.PersonelID=p.PersonelID
LEFT JOIN
PAY.PayrollAccGroup AS pag
ON pag.PayrollAccGroupID=pvs.PayrollAccGroupID
LEFT JOIN
HRM.EmploymentType AS et
ON et.EmploymentTypeID=lg.EmploymentTypeId
LEFT JOIN
CFG.CostCenter AS cc
ON cc.CostCenterID=lg.CostCenterId
LEFT JOIN
HRM.WorkPlace AS pos
ON pos.WorkPlaceID=lg.WorkPlaceID
JOIN
CFG.Party AS p3
ON p3.PartyID=p.PartyID
JOIN
PAY.Parameter AS p2
ON p2.ParameterID=r.ParameterID
LEFT JOIN
#LastFetched lf
ON lf.PersonnelID=r.PersonelID
AND lf.ParameterID=r.ParameterID

    WHERE r.[Value]-ISNULL( lf.Value, 0 )<>0
    ORDER BY r.PersonelID,
             p2.ParameterID;
END;
