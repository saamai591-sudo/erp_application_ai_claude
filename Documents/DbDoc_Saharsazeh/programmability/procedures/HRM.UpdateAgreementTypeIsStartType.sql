/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 2/26/2018 10:36:50 AM
 ************************************************************/

CREATE PROCEDURE [HRM].[UpdateAgreementTypeIsStartType]
AS
	UPDATE Hrm.AgreementType
	SET    IsStartType = 0
	
	UPDATE Hrm.AgreementType
	SET    IsStartType = 1
	WHERE  NOT EXISTS (
	           SELECT 1
	           FROM   hrm.AgreementTypePrePersonelStatus AS atpps
	                  INNER JOIN HRM.PersonelStatus AS ps2
	                       ON  ps2.PersonelStatusID = atpps.PersonelStatusID
	           WHERE  atpps.AgreementTypeID = Hrm.AgreementType.AgreementTypeID
	                  AND ps2.StatusType NOT IN (100, 3)
	       )
	       AND EXISTS (
	               SELECT 1
	               FROM   hrm.AgreementTypePrePersonelStatus AS atpps
	               WHERE  atpps.AgreementTypeID = Hrm.AgreementType.AgreementTypeID
	           )
