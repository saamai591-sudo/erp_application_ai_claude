CREATE FUNCTION [HRM].[GetNewAgreementSerial]
(
	@personelId          INT,
	@AgreementTypeID     INT,
	@IssueDate           DATE,
	@AgreementId	INT=null
)
RETURNS INT

BEGIN
	DECLARE @AgreementTypeFormID     TINYINT,
	        @Year                    INT
	
	
	SELECT @Year = cm.CalendarID
	FROM   hrm.CalendarMonth AS cm
	WHERE  @IssueDate BETWEEN cm.StartDate AND cm.EndDate
	
	SELECT @AgreementTypeFormID = at.AgreementTypeFormID
	FROM   hrm.AgreementType AS at
	WHERE  at.AgreementTypeID = @AgreementTypeID
	
	DECLARE @AgreementSerialStartNo      INT,
	        @AgreementSerialAgreementTypeForm BIT,
	        @AgreementSerialAgreementType BIT,
	        @AgreementSerialPersonel     BIT,
	        @AgreementSerialYear         BIT
	
	SELECT @AgreementSerialStartNo = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialStartNo'
	
	
	SELECT @AgreementSerialAgreementTypeForm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialAgreementTypeForm'
	
	SELECT @AgreementSerialAgreementType = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialAgreementType'
	
	SELECT @AgreementSerialPersonel = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialPersonel'
	
	SELECT @AgreementSerialYear = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementSerialYear'
	
	
	RETURN ISNULL(
	    (
	        SELECT MAX(serial)+1
	        FROM   hrm.Agreement AS a
	               INNER JOIN hrm.AgreementType AS at
	                    ON  at.AgreementTypeID = a.AgreementTypeID
	               INNER JOIN hrm.CalendarMonth AS cm
	                    ON  a.IssueDate BETWEEN cm.StartDate AND cm.EndDate
	        WHERE a.AgreementID<>@AgreementId AND  (@AgreementSerialPersonel = 0 OR a.PersonelID = @personelId)
	               AND (
	                       @AgreementSerialAgreementTypeForm = 0
	                       OR ISNULL(at.AgreementTypeFormID, 255) = ISNULL(@AgreementTypeFormID, 255)
	                   )
	               AND (
	                       @AgreementSerialAgreementType = 0
	                       OR a.AgreementTypeID = @AgreementTypeID
	                   )
	               AND (@AgreementSerialYear = 0 OR cm.CalendarID = @Year)
	    ),
	    @AgreementSerialStartNo
	)
END

